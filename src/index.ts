import { type Overrides, type Signer, utils, BigNumber } from 'ethers'
import { Subgraph } from './subgraph'
import { ContractCache } from './contractCache'
import { DB } from './db'
import {
  fetchData,
  filterTicketData,
  increaseGasForTx,
  induceDelay,
  normalizeTicketData,
  sortAndselectOnlyConsecutiveEpoch
} from './helper'
import { createUnsignedTransaction } from './transactions'
import { type Epoch, type TicketConfig, type DataConfig, type SelectedClusterData } from './types'
import * as dotenv from 'dotenv'
dotenv.config()

const MAX_GAS_LIMIT = BigNumber.from(process.env.MAX_GAS_LIMIT || '10000000')
const GAS_PRICE_INCREMENT = BigNumber.from(process.env.GAS_PRICE_INCREMENT || '110')
const MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT = BigNumber.from(process.env.MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT || 96).toNumber()
const TRANSACTION_WAIT_TIME = BigNumber.from(process.env.TRANSACTION_WAIT_TIME || '1200000').toNumber()
const MAX_CLUSTERS_TO_SELECT = BigNumber.from(process.env.MAX_CLUSTERS_TO_SELECT || '5').toNumber()
const BATCH_TIME = BigNumber.from(process.env.BATCH_TIME || 4*60*60*1000+'').toNumber()
const START_EPOCH = BigNumber.from(process.env.START_EPOCH || 3168+'').toNumber()

//telemetry vars
const TELEMETRY_URL = process.env.TELEMETRY_URL;
const TELEMETRY_DATA_LENGTH = BigNumber.from(process.env.TELEMETRY_DATA_LENGTH || 24*60*60+'').toNumber();
const TELEMETRY_INTERVAL = BigNumber.from(process.env.TELEMETRY_INTERVAL || '900').toNumber();

export class Ticketing {
  private readonly dataConfig: DataConfig
  private readonly signer: Signer
  private readonly subgraph: Subgraph
  private ticketConfig: TicketConfig
  private db: DB
  private contractCache: ContractCache
  private initialized: boolean

  constructor (config: DataConfig, signer: Signer) {
    this.dataConfig = config
    this.signer = signer
    this.initialized = false
    this.subgraph = new Subgraph(config.subgraphUrl)
  }

  // Init functions start
  public async init (): Promise<Ticketing> {
    console.log(`${(new Date()).toJSON()} Global Init initiated`);
    //TODO: validate config
    const configData = await this.getConfigData()

    this.ticketConfig = {
      epochData: { epochLengthInSeconds: 0 },
      contractAddresses: {
        ReceiverStaking: null,
        ClusterRewards: null,
        ClusterRegistry: null,
        RewardDelegators: null,
        StakeManager: null,
        ClusterSelectors: []
      },
      receiverConfig: null,
      subgraphUrl: null,
      ticketConfig: null
    }
    this.ticketConfig.subgraphUrl = this.dataConfig.subgraphUrl
    this.ticketConfig.ticketConfig = this.dataConfig.ticketConfig
    this.ticketConfig.receiverConfig = this.dataConfig.receiverConfig

    this.ticketConfig.epochData.epochLengthInSeconds = configData.params
      .filter((a) => a.id === 'EPOCH_LENGTH')
      .map((a) => parseInt(a.value))[0]

    this.ticketConfig.contractAddresses.ReceiverStaking = configData.contractStores
      .filter((a) => a.id === 'RECEIVER_STAKING')
      .map((a) => a.address.toLowerCase())[0]
    this.ticketConfig.contractAddresses.ClusterRewards = configData.contractStores
      .filter((a) => a.id === 'CLUSTER_REWARD')
      .map((a) => a.address.toLowerCase())[0]

    this.ticketConfig.contractAddresses.ClusterRegistry = configData.contractStores
      .filter((a) => a.id === 'CLUSTER_REGISTRY')
      .map((a) => a.address.toLowerCase())[0]

    this.ticketConfig.contractAddresses.RewardDelegators = configData.contractStores
      .filter((a) => a.id === 'REWARD_DELEGATORS')
      .map((a) => a.address.toLowerCase())[0]

    this.ticketConfig.contractAddresses.StakeManager = configData.contractStores
      .filter((a) => a.id === 'STAKE_MANAGER')
      .map((a) => a.address.toLowerCase())[0]

    this.ticketConfig.contractAddresses.ClusterSelectors = configData.selectors.map((a) => {
      return {
        ...a,
        networkId: a.networkId,
        contractAddress: a.id
      }
    })

    this.db = new DB(this.ticketConfig.ticketConfig, this.ticketConfig.receiverConfig, this.ticketConfig.epochData)
    console.log(`${(new Date()).toJSON()} DB module created`);

    this.contractCache = new ContractCache(
      this.ticketConfig.contractAddresses.ReceiverStaking,
      this.ticketConfig.contractAddresses.ClusterRewards,
      this.ticketConfig.contractAddresses.ClusterSelectors,
      this.signer
    )
    console.log(`${(new Date()).toJSON()} Contract module created`);
    await this.contractCache.init()
    console.log(`${(new Date()).toJSON()} Contract module initialized`);

    await this.db.init(this.contractCache.receiver)
    await this.db.createRequiredTables()
    console.log(`${(new Date()).toJSON()} DB module initialized`);
    this.initialized = true
    console.log(`${(new Date()).toJSON()} Global init complete`);
    return this
  }

  public if_init (): void {
    if (!this.initialized) throw new Error('Not initialized, call object.init(), before using')
  }
  // Init functions ends

  // telemetry starts
  public async telemetryJob(networkId: string): Promise<void> {
    this.if_init();
    while(true && TELEMETRY_URL) {
      try {
        await this.submitTelemetry(networkId);
        await induceDelay(TELEMETRY_INTERVAL*1000)
      } catch(ex) {
        console.log(ex)
        await induceDelay(1000)
      }
    }
  }

  public async submitTelemetry(networkId: string): Promise<void> {
    console.log(`${(new Date()).toJSON()} generating Telemetry for last ${TELEMETRY_DATA_LENGTH} seconds`);
    const firstEpoch = (await this.contractCache.getEpoch(Date.now()/1000-TELEMETRY_DATA_LENGTH)) - 1;
    const epochLength = await this.contractCache.EPOCH_LENGTH;
    let epochs = [...Array(TELEMETRY_DATA_LENGTH/epochLength).keys()].map((a) => (firstEpoch+a).toString());
    const epochData = await this.fetchSelectedTicketData(networkId, epochs);
    
    const options = {
      url: TELEMETRY_URL,
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({epochData, receiver: this.contractCache.receiver})
    };
    try {
      await (await fetchData(options)).json()
      console.log(`${(new Date()).toJSON()} Telemetry submitted for last ${TELEMETRY_DATA_LENGTH} seconds`);
    } catch(e) {
      console.error(e);
      throw new Error('Error while pushing telemetry')
    }
  }
  // telemetry ends

  // daily job starts
  public async dailyJob (networkId: string, repeatEveryMs: number, ifErrorRetryAfter: number): Promise<never> {
    this.if_init()
    while (true) {
      try {
        console.log(`${(new Date()).toJSON()} Starting ticket submission`);
        const waitTime = await this.submitTicketForEpochs(networkId, repeatEveryMs)
        console.log(`${(new Date()).toJSON()} Waiting for ${waitTime} after running ticket submission`);
        await induceDelay(waitTime)
      } catch (ex) {
        console.log(ex)
        await induceDelay(ifErrorRetryAfter)
      }
    }
  }
  // daily job ends

  // Core functions starts
  public async submitTicketForEpochs (
    networkId: string,
    repeatEveryMs: number,
    options?: Overrides
  ): Promise<number> {
    this.if_init()
    console.log(`${(new Date()).toJSON()} Checking for pending transaction`);
    const waitTime = await this.checkForPendingTransaction()
    if (waitTime != 0) {
      return waitTime
    }
    console.log(`${(new Date()).toJSON()} All pending transactions processed`);

    let lastSubmittedEpochLocal = await this.lastSubmitedEpochAsPerLocalDb()
    // TicketsIssued is emitted with msg.sender, which is the signer, not the staker
    let lastSubmittedEpoch: number
    try {
      lastSubmittedEpoch = (await this.getLastSubmittedEpochAsPerSubgraph(await this.signer.getAddress()))
    } catch (ex) {
      // without a local value there is nothing to check against the contract
      if(!lastSubmittedEpochLocal) throw ex
      console.warn(`${(new Date()).toJSON()} Could not fetch last submitted epoch from subgraph, checking epoch ${lastSubmittedEpochLocal} with the contract`);
      console.warn(ex)
      lastSubmittedEpoch = 0
    }

    if(lastSubmittedEpochLocal) {
      if(lastSubmittedEpochLocal < lastSubmittedEpoch) {
        // transactions submitted offband, so ensure if all epochs in between are covered
        console.warn(`${(new Date()).toJSON()} Manual transaction submission detected, initiating cleanup`);
        return await this.submitMissingEpochs(lastSubmittedEpochLocal, lastSubmittedEpoch, networkId);
      } else if(lastSubmittedEpochLocal > lastSubmittedEpoch) {
        // subgraph has not indexed the last transaction yet, is not reachable, or has no tickets
        // for this signer (signer was changed), so check with the contract which is keyed by receiver
        if(!(await this.contractCache.checkIfTicketIsIssued(lastSubmittedEpochLocal.toString()))) {
          console.log(`${(new Date()).toJSON()} Tickets for epoch ${lastSubmittedEpochLocal} not issued as per contract, wait for the transaction to complete`);
          return TRANSACTION_WAIT_TIME;
        }
        console.log(`${(new Date()).toJSON()} Subgraph is behind at epoch ${lastSubmittedEpoch}, tickets for epoch ${lastSubmittedEpochLocal} are issued as per contract`);
      }
      lastSubmittedEpoch = lastSubmittedEpochLocal
    }

    if(!lastSubmittedEpoch) {
      console.log(`${(new Date()).toJSON()} No tickets submitted till now, checking db for oldest tickets`);
      const firstTs = await this.db.getTimeOfFirstTicketAfter(0);
      if(firstTs == 0) {
        console.log(`${(new Date()).toJSON()} No tickets to submit`)
        return BATCH_TIME
      }
      console.log(`${(new Date()).toJSON()} First ticket found at ${firstTs}`);
      lastSubmittedEpoch = this.contractCache.getEpoch(firstTs) - 1;
      if(START_EPOCH - 1 > lastSubmittedEpoch) lastSubmittedEpoch = START_EPOCH - 1
    }
    console.log(`${(new Date()).toJSON()} Last submitted epoch is ${lastSubmittedEpoch}`)

    const oldestReceiptTs = await this.db.getTimeOfFirstTicketAfter((await this.contractCache.getEpochTime(lastSubmittedEpoch))[0]);
    console.log(`${(new Date()).toJSON()} First ticket after ${lastSubmittedEpoch} epoch found at ${oldestReceiptTs}`);
    const oldestReceiptEpoch = this.contractCache.getEpoch(oldestReceiptTs);
    
    if(oldestReceiptEpoch > lastSubmittedEpoch +  1) {
      console.log(`${(new Date()).toJSON()} No tickets after ${lastSubmittedEpoch} till ${oldestReceiptEpoch}, Skipping till ${oldestReceiptEpoch}`)
      lastSubmittedEpoch = oldestReceiptEpoch;
    }

    // and send txs till last submitted epoch is less than one day olds
    let currentEpoch = await this.contractCache.getLatestEpoch();
    console.log(`${(new Date()).toJSON()} Current epoch is ${currentEpoch}`)
    if(currentEpoch - lastSubmittedEpoch < MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT + 2) { // +2 ensure only past epochs get tickets
      console.log(`${(new Date()).toJSON()} Waiting to reach ${MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT} epochs before bundling tickets`)
      return BATCH_TIME
    };

    console.log(`${(new Date()).toJSON()} Generating tickets for ${MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT} starting ${lastSubmittedEpoch+1} to ${lastSubmittedEpoch+MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT}`)
    let _epochs = [...Array(MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT).keys()]
      .map((a) => (lastSubmittedEpoch + a + 1).toString())

    let gasPrice

    if (options?.gasPrice) {
      gasPrice = options.gasPrice
    } else {
      gasPrice = await this.signer.getGasPrice()
    }

    let gasLimit
    if (options?.gasLimit) {
      gasLimit = options.gasLimit
    } else {
      gasLimit = MAX_GAS_LIMIT
    }

    // fetch tickets only for selected clusters
    let ticketData: Epoch[] = await this.fetchSelectedTicketData(networkId, _epochs)
    console.log(`${(new Date()).toJSON()} Ticket data fetched for all epochs`);
    console.log(ticketData);

    // select epochs that have atleast one cluster present, then normalize the data
    ticketData = ticketData.map((a) => normalizeTicketData(a))
    ticketData = sortAndselectOnlyConsecutiveEpoch(ticketData)
    const nonce = await this.signer.getTransactionCount();

    // if no epoch is there, then we job will be paused for some time
    if (ticketData.length > 0) {
      const transaction = await createUnsignedTransaction.submitTicketForEpochs(
        this.signer,
        this.ticketConfig.contractAddresses.ClusterRewards,
        ticketData,
        MAX_CLUSTERS_TO_SELECT,
        { ...options, gasPrice, gasLimit, nonce }
      )

      const newOperationNumber = BigNumber.from(await this.db.getLastOperationNumber())
        .add(1)
        .toNumber()

      const signedTx = await this.signer.signTransaction(transaction)
      for (let index = 0; index < ticketData.length; index++) {
        const element = ticketData[index]

        await this.db.savePendingTransaction(newOperationNumber, parseInt(element.epoch), signedTx)
      }
      // gas estimation above fails if tickets for any of these epochs are already issued
      await this.signer.provider.sendTransaction(signedTx)
      console.log(`${(new Date()).toJSON()} First ticket found at `);
      return TRANSACTION_WAIT_TIME
    } else {
      console.log('No epoch data found')
      return repeatEveryMs
    }
  }
  // Core functions ends

  // Helper functions start
  private async checkForPendingTransaction (): Promise<number> {
    const lastOperationData = await this.db.getLastOperationData()

    // if this was no operation before, then nothing pending to check
    if (lastOperationData.length == 0) {
      console.log(`${(new Date()).toJSON()} No pending transactions`);
      return 0
    }

    console.log(`${(new Date()).toJSON()} Processing last transaction`);

    // check if last operation is complete
    const pendingTx = lastOperationData[0].data
    const tx = utils.parseTransaction(pendingTx)
    const receipt = await this.signer.provider.getTransactionReceipt(tx.hash)

    if (receipt?.status) {
      console.log(`${(new Date()).toJSON()} Last transaction successful`);
      // if receipt exists and status is true, and move to next operation immediately
      await this.db.deleteOperation(lastOperationData[0].operation)
      await this.db.updateLatestEpoch(Math.max(...lastOperationData.map(e => e.epoch)));
      return 0
    }
    console.log(`${(new Date()).toJSON()} Last transaction not finalized yet`);
    // receipt does not exist, i.e, it is not mined or tx failed and status is false

    // to avoid any edge case, manually check if all the epochs in the given transaction are included
    // epochs are fetched in descending order
    const issued: boolean[] = []
    for (let index = 0; index < lastOperationData.length; index++) {
      const data = lastOperationData[index]
      issued.push(await this.contractCache.checkIfTicketIsIssued(data.epoch.toString()))
    }

    if (issued.every((e) => e)) {
      // tickets for all epochs are issued by some other transaction, nothing left to send
      console.log(`${(new Date()).toJSON()} Tickets for all epochs in last transaction are already issued`);
      await this.db.deleteOperation(lastOperationData[0].operation)
      await this.db.updateLatestEpoch(Math.max(...lastOperationData.map(e => e.epoch)));
      return 0
    }

    if (issued.some((e) => e)) {
      // sending the same transaction again will revert as some of its epochs are issued, so drop it
      console.log(`${(new Date()).toJSON()} Tickets for some epochs in last transaction are already issued, dropping it`);
      await this.db.deleteOperation(lastOperationData[0].operation)
      // epochs before the first epoch that is not issued are done, rest are generated again
      const firstPendingEpoch = Math.min(...lastOperationData.filter((_, index) => !issued[index]).map(e => e.epoch))
      const issuedBeforePending = lastOperationData.filter((e, index) => issued[index] && e.epoch < firstPendingEpoch).map(e => e.epoch)
      if (issuedBeforePending.length > 0) {
        await this.db.updateLatestEpoch(Math.max(...issuedBeforePending));
      }
      return 0
    }

    if (receipt) {
      // transaction is mined but reverted, sending the same data again will revert again
      // drop it so that tickets are generated again
      console.log(`${(new Date()).toJSON()} Last transaction ${tx.hash} reverted, dropping it`);
      await this.db.deleteOperation(lastOperationData[0].operation)
      return 0
    }

    console.log(`${(new Date()).toJSON()} Transaction is not mined, retrying`)
    
    // update tx nonce in case prev tx failed
    tx.nonce = await this.signer.getTransactionCount();
    // this means transaction is unmined and it's gas price can be increased
    const signedTx = await this.bumpGas(tx, lastOperationData[0].operation, lastOperationData.map(e => e.epoch));
    console.log(`${(new Date()).toJSON()} Gas bumped for tx`)

    // // un-comment this to see how the transaction is constructed
    // await this.signer.sendTransaction(utils.parseTransaction(signedTx))

    await this.signer.provider.sendTransaction(signedTx)
    console.log(`${(new Date()).toJSON()} Transaction resubmitted with higher gas price`);

    return TRANSACTION_WAIT_TIME
  }

  public async bumpGas(tx, operation, epochs: number[]): Promise<string> {
    const gasPrice = await this.signer.getGasPrice()
    const newTx = increaseGasForTx(tx, gasPrice, GAS_PRICE_INCREMENT)
    const populatedTransaction = await this.signer.populateTransaction(newTx)
    const signedTx = await this.signer.signTransaction(populatedTransaction)

    // console.log({ signedTx: utils.parseTransaction(signedTx) })
    // Old tx related data is deleted
    await this.db.deleteOperation(operation)

    for (let index = 0; index < epochs.length; index++) {
      // New tx related data is added
      await this.db.savePendingTransaction(operation, epochs[index], signedTx)
    }

    return signedTx;
  }

  public async fetchSelectedTicketData (networkId: string, _epochs: string[]): Promise<Epoch[]> {
    this.if_init()
    const clustersToSelect: string[][] = await Promise.all(
      _epochs.map(async (a) => (await this.contractCache.getSelectedClusters(networkId, a)).map(a => a.toLowerCase()))
    )
    let ticketData = await this.fetchAllTicketData(networkId, _epochs, clustersToSelect)
    ticketData = filterTicketData(ticketData, clustersToSelect)
    return ticketData
  }

  public async lastSubmitedEpochAsPerLocalDb (): Promise<number | null> {
    this.if_init()
    const result = await this.db.getLastProcessedEpoch()
    return result;
  }

  public async fetchAllTicketData (networkId: string, _epochs: string[], selectedClusters: string[][]): Promise<Epoch[]> {
    this.if_init()
    const epochBoundaries: [number, number][] = []
    for (let index = 0; index < _epochs.length; index++) {
      const element = _epochs[index]
      epochBoundaries.push(await this.contractCache.getEpochTime(element))
    }
    return await this.db.fetchTicketsForEpochs(networkId, _epochs, epochBoundaries, selectedClusters)
  }

  public async getClustersSelectedAfterGivenEpoch (epoch: string): Promise<SelectedClusterData[]> {
    this.if_init()
    return (await this.subgraph.getClustersSelectedAfterGivenEpoch(epoch)).map((a) => {
      const value = {
        ...a,
        networkId: a.network.id
      }
      delete value.network
      return value
    })
  }

  public async getAllClustersSelectedInGivenEpochs (epochs: string[]): Promise<SelectedClusterData[]> {
    this.if_init()
    return (await this.subgraph.getAllClustersSelectedInGivenEpochs(epochs)).map((a) => {
      const value = {
        ...a,
        networkId: a.network.id
      }
      delete value.network
      return value
    })
  }

  public async getLastSubmittedEpochAsPerSubgraph (address: string): Promise<number> {
    const data = await this.subgraph.getLastSubmittedEpochForGivenAddress(address)
    if (data.length === 0) {
      return 0
    } else {
      return parseInt(data[0].epoch)
    }
  }

  public async getConfigData (): Promise<any> {
    return await this.subgraph.getConfigData()
  }

  public async submitMissingEpochs(lastEpochLocal: number, lastEpoch: number, networkId: string, options?: Overrides): Promise<number> {
    const missedEpochs: string[] = [];
    let lastCheckedEpoch = lastEpochLocal;
    for(let epoch=lastEpochLocal+1; epoch <= lastEpoch; epoch++) {
      const isIssued = await this.contractCache.checkIfTicketIsIssued(epoch+"");
      if(!isIssued) missedEpochs.push(epoch+"");
      lastCheckedEpoch = epoch;
      if(missedEpochs.length >= MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT) break;
    }

    if(missedEpochs.length == 0) {
      // nothing is missing, continue from the last epoch as per subgraph
      console.log(`${(new Date()).toJSON()} Tickets are issued for all epochs till ${lastEpoch}`);
      await this.db.updateLatestEpoch(lastEpoch);
      return 0;
    }

    let ticketData: Epoch[] = await this.fetchSelectedTicketData(networkId, missedEpochs)

    ticketData = ticketData.filter((a) => a.clusters.length > 0).map((a) => normalizeTicketData(a))
    ticketData = sortAndselectOnlyConsecutiveEpoch(ticketData)

    if(ticketData.length == 0) {
      // no clusters are selected in the missing epochs, so tickets can't be issued for them
      console.log(`${(new Date()).toJSON()} No clusters selected in epochs ${missedEpochs[0]} to ${lastCheckedEpoch} with no tickets, skipping till ${lastCheckedEpoch}`);
      await this.db.updateLatestEpoch(lastCheckedEpoch);
      return 0;
    }

    let gasPrice

    if (options?.gasPrice) {
      gasPrice = options.gasPrice
    } else {
      gasPrice = await this.signer.getGasPrice()
    }

    let gasLimit
    if (options?.gasLimit) {
      gasLimit = options.gasLimit
    } else {
      gasLimit = MAX_GAS_LIMIT
    }

    const nonce = await this.signer.getTransactionCount();

    const transaction = await createUnsignedTransaction.submitTicketForAdhocEpochs(
      this.signer,
      this.ticketConfig.contractAddresses.ClusterRewards,
      ticketData,
      { ...options, gasPrice, gasLimit, nonce }
    )

    const newOperationNumber = BigNumber.from(await this.db.getLastOperationNumber())
      .add(1)
      .toNumber()

    const signedTx = await this.signer.signTransaction(transaction)
    for (let index = 0; index < ticketData.length; index++) {
      const element = ticketData[index]

      await this.db.savePendingTransaction(newOperationNumber, parseInt(element.epoch), signedTx)
    }
    // gas estimation above fails if tickets for any of these epochs are already issued
    await this.signer.provider.sendTransaction(signedTx)
    return TRANSACTION_WAIT_TIME
  }
}