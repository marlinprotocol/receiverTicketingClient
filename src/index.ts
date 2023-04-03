import { type TransactionResponse } from '@ethersproject/abstract-provider'
import { type Overrides, type Signer, utils, BigNumber } from 'ethers'
import { Subgraph } from './subgraph'
import { ContractCache } from './contractCache'
import { DB } from './db'
import {
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

const MAX_GAS_LIMIT = BigNumber.from(process.env.MAX_GAS_LIMIT || '1000000')
const GAS_PRICE_INCREMENT = BigNumber.from(process.env.GAS_PRICE_INCREMENT || '110')
const MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT = BigNumber.from(process.env.MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT || 96).toNumber()
const TRANSACTION_WAIT_TIME = BigNumber.from(process.env.TRANSACTION_WAIT_TIME || '60000').toNumber()
const MAX_CLUSTERS_TO_SELECT = BigNumber.from(process.env.MAX_CLUSTERS_TO_SELECT || '5').toNumber()
const BATCH_TIME = BigNumber.from(process.env.BATCH_TIME || 24*60*60*1000+'').toNumber()

export class Ticketing {
  private readonly dataConfig: DataConfig
  private ticketConfig: TicketConfig
  private readonly signer: Signer
  private db: DB
  private initialized: boolean
  private contractCache: ContractCache
  private readonly subgraph: Subgraph

  constructor (config: DataConfig, signer: Signer) {
    this.dataConfig = config
    this.signer = signer
    this.initialized = false
    this.subgraph = new Subgraph(config.subgraphUrl)
  }

  // daily job starts
  public async dailyJob (networkId: string, repeatEveryMs: number, ifErrorRetryAfter: number): Promise<never> {
    this.if_init()
    while (true) {
      try {
        const waitTime = await this.submitTicketForEpochs(networkId, repeatEveryMs)
        await induceDelay(waitTime)
      } catch (ex) {
        console.log(ex)
        await induceDelay(ifErrorRetryAfter)
      }
    }
  }
  // daily job ends

  // Init functions start
  public async init (): Promise<Ticketing> {
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

    this.contractCache = new ContractCache(
      this.ticketConfig.contractAddresses.ReceiverStaking,
      this.ticketConfig.contractAddresses.ClusterRewards,
      this.ticketConfig.contractAddresses.ClusterSelectors,
      this.signer
    )
    await this.contractCache.init()

    await this.db.init(this.contractCache.receiver)
    await this.db.createRequiredTables()
    this.initialized = true
    return this
  }

  public if_init (): void {
    if (!this.initialized) throw new Error('Not initialized, call object.init(), before using')
  }
  // Init functions ends

  // Core functions starts
  public async submitTicketForEpochs (
    networkId: string,
    repeatEveryMs: number,
    options?: Overrides
  ): Promise<number> {
    this.if_init()
    // process any pending tx
    const waitTime = await this.checkForPendingTransaction()
    if (waitTime != 0) {
      return waitTime
    }

    let lastSubmittedEpochLocal = await this.lastSubmitedEpochAsPerLocalDb()
    let lastSubmittedEpoch = (await this.getLastSubmittedEpochAsPerSubgraph(await this.signer.getAddress()))

    if(lastSubmittedEpochLocal) {
      if(lastSubmittedEpochLocal < lastSubmittedEpoch) {
        // transactions submitted offband, so ensure if all epochs in between are covered
        return await this.submitMissingEpochs(lastSubmittedEpochLocal, lastSubmittedEpoch, networkId);
      } else if(lastSubmittedEpochLocal > lastSubmittedEpoch) {
        // transactions are submitted but not updated on subgraph yet, so wait
        // this case shouldn't come at all
        return TRANSACTION_WAIT_TIME;
      }
    }

    if(!lastSubmittedEpoch) {
      const firstTs = await this.db.getTimeOfFirstTicket();
      lastSubmittedEpoch = this.contractCache.getEpoch(firstTs) - 1;
    }

    // and send txs till last submitted epoch is less than one day olds
    let currentEpoch = await this.contractCache.getLatestEpoch();
    if(currentEpoch - lastSubmittedEpoch < MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT) return BATCH_TIME;

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

    // select epochs that have atleast one cluster present, then normalize the data
    // TODO: revert if clusters are not selected in an epoch, also def not filter
    ticketData = ticketData.filter((a) => a._clusters.length > 0).map((a) => normalizeTicketData(a))
    ticketData = sortAndselectOnlyConsecutiveEpoch(ticketData)

    console.log(JSON.stringify({ ticketData, networkId, _epochs }, null, 4))

    // if no epoch is there, then we job will be paused for some time
    if (ticketData.length > 0) {
      const transaction = await createUnsignedTransaction.submitTicketForEpochs(
        this.signer,
        this.ticketConfig.contractAddresses.ClusterRewards,
        ticketData,
        MAX_CLUSTERS_TO_SELECT,
        { ...options, gasPrice, gasLimit }
      )

      const newOperationNumber = BigNumber.from(await this.db.getLastOperationNumber())
        .add(1)
        .toNumber()

      const signedTx = await this.signer.signTransaction(transaction)
      for (let index = 0; index < ticketData.length; index++) {
        const element = ticketData[index]

        await this.db.savePendingTransaction(newOperationNumber, parseInt(element._epoch), signedTx)
      }
      const isValid = _epochs.every(async (epoch) => {
        return await this.contractCache.checkIfTicketIsIssued(epoch)
      });
  
      // Note: This error should never be triggered (except in race conditions)
      // if triggered rerun and submit missing epochs
      if(!isValid) return 1;
      await this.signer.provider.sendTransaction(signedTx)
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
    if (lastOperationData.length == 0) return 0

    // check if last operation is complete
    const pendingTx = lastOperationData[0].data
    const tx = utils.parseTransaction(pendingTx)
    const receipt = await this.signer.provider.getTransactionReceipt(tx.hash)

    if (receipt?.status) {
      // if receipt exists and status is true, and move to next operation immediately
      await this.db.deleteOperation(lastOperationData[0].operation)
      await this.db.updateLatestEpoch(Math.max(...lastOperationData.map(e => e.epoch)));
      return 0
    }
    // receipt does not exist, i.e, it is not mined or tx failed and status is false

    // to avoid any edge case, manually check if all the epochs in the given transaction are included
    let lastOperationCompleted: boolean = true
    for (let index = 0; index < lastOperationData.length; index++) {
      const data = lastOperationData[index]
      const isSubmitted = await this.contractCache.checkIfTicketIsIssued(data.epoch.toString())

      if (isSubmitted) {
        await this.db.deleteEpoch(data.epoch)
      } else {
        lastOperationCompleted = false;
      }
    }

    // repeat the process once again (this will clean up all junk epochs)
    if (!lastOperationCompleted) {
      // missing epoch will take care of this
      // TODO: What if first epoch does this, in that missing epoch might not be able to take care
      return 0
    }

    const txCount = await this.signer.getTransactionCount()
    console.log('receipt is not mined')
    console.log({ lastOperationCompleted, txCount, 'tx.nonce': tx.nonce })
    if (txCount > tx.nonce) {
      // means transaction will never get mined, move to next operation
      await this.db.deleteOperation(lastOperationData[0].operation)
      return 1
    }
    
    // if there is a tx with lower nonce, wait for them to get mined
    if (txCount < tx.nonce) { return TRANSACTION_WAIT_TIME }
    
    // this means transaction is unmined and it's gas price can be increased
    const signedTx = await this.bumpGas(tx, lastOperationData[0].operation, lastOperationData.map(e => e.epoch));

    // // un-comment this to see how the transaction is constructed
    // await this.signer.sendTransaction(utils.parseTransaction(signedTx))

    await this.signer.provider.sendTransaction(signedTx)

    return TRANSACTION_WAIT_TIME
  }

  public async bumpGas(tx, operation, epochs: number[]): Promise<string> {
    const gasPrice = await this.signer.getGasPrice()
    const newTx = increaseGasForTx(tx, gasPrice, GAS_PRICE_INCREMENT)
    const populatedTransaction = await this.signer.populateTransaction(newTx)
    const signedTx = await this.signer.signTransaction(populatedTransaction)

    // console.log({ signedTx: utils.parseTransaction(signedTx) })
    // Old tx related data is deleted
    // TODO: Instead update the old tx and hash with new tx and hash
    await this.db.deleteOperation(operation)

    for (let index = 0; index < epochs.length; index++) {
      // New tx related data is added
      await this.db.savePendingTransaction(operation, epochs[index], signedTx)
    }

    return signedTx;
  }

  public async fetchSelectedTicketData (_networkId: string, _epochs: string[]): Promise<Epoch[]> {
    this.if_init()
    let ticketData = await this.fetchAllTicketData(_networkId, _epochs)
    const clustersToSelect: string[][] = await Promise.all(
      _epochs.map(async (a) => await this.contractCache.getSelectedClusters(_networkId, a))
    )
    ticketData = filterTicketData(ticketData, clustersToSelect)
    return ticketData
  }

  public async lastSubmitedEpochAsPerLocalDb (): Promise<number | null> {
    this.if_init()
    const result = await this.db.getLastProcessedEpoch()
    return result;
  }

  public async fetchAllTicketData (_networkId: string, _epochs: string[]): Promise<Epoch[]> {
    this.if_init()
    const epochEndTimes: number[] = []
    for (let index = 0; index < _epochs.length; index++) {
      const element = _epochs[index]
      const [, epochEndTime] = await this.contractCache.getEpochTime(element)
      epochEndTimes.push(epochEndTime)
    }
    // TODO: use startTime and end time instead of just  using epochtime and calculating start time in query
    return await this.db.fetchTicketsForEpochs(_networkId, _epochs, epochEndTimes)
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
    const missedEpochs = [];
    for(let epoch=lastEpochLocal; epoch <= lastEpoch; epoch++) {
      const isIssued = this.contractCache.checkIfTicketIsIssued(epoch+"");
      if(!isIssued) missedEpochs.push(epoch);
      if(missedEpochs.length >= MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT) break;
    }

    let ticketData: Epoch[] = await this.fetchSelectedTicketData(networkId, missedEpochs)

    ticketData = ticketData.filter((a) => a._clusters.length > 0).map((a) => normalizeTicketData(a))
    ticketData = sortAndselectOnlyConsecutiveEpoch(ticketData)

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

    const transaction = await createUnsignedTransaction.submitTicketForAdhocEpochs(
      this.signer,
      this.ticketConfig.contractAddresses.ClusterRewards,
      ticketData,
      { ...options, gasPrice, gasLimit }
    )

    const newOperationNumber = BigNumber.from(await this.db.getLastOperationNumber())
      .add(1)
      .toNumber()

    const signedTx = await this.signer.signTransaction(transaction)
    for (let index = 0; index < ticketData.length; index++) {
      const element = ticketData[index]

      await this.db.savePendingTransaction(newOperationNumber, parseInt(element._epoch), signedTx)
    }
    const isValid = missedEpochs.every(async (epoch) => {
      return await this.contractCache.checkIfTicketIsIssued(epoch)
    });

    // Note: This error should never be triggered (except in race conditions)
    // if triggered rerun and submit missing epochs
    if(!isValid) return 1;
    await this.signer.provider.sendTransaction(signedTx)
    return TRANSACTION_WAIT_TIME
  }
}