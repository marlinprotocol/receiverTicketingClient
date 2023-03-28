import { type TransactionResponse } from '@ethersproject/abstract-provider'
import { type Overrides, type Signer, utils, BigNumber } from 'ethers'
import { Subgraph } from './subgraph'
import { ContractCache } from './contractCache'
import { DB } from './db'
import {
  filterTicketData,
  getUnsignedTransactionFromSignedTransaction,
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
const TRANSACTION_WAIT_TIME = BigNumber.from(process.env.TRANSACTION_WAIT_TIME || '600000').toNumber()
const MAX_CLUSTERS_TO_SELECT = BigNumber.from(process.env.MAX_CLUSTERS_TO_SELECT || '5').toNumber()

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
        const [, waitTime] = await this.submitTicketForEpochs(networkId, repeatEveryMs)
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
  ): Promise<[TransactionResponse | null, number]> {
    this.if_init()
    const [tx, waitTime] = await this.checkForPendingTransaction()
    if (tx) {
      return [tx, waitTime]
    }

    let lastSubmittedEpoch = await this.lastSubmitedEpochAsPerLocalDb()
    if (!lastSubmittedEpoch) {
      lastSubmittedEpoch = (await this.getLastSubmittedEpochAsPerSubgraph(await this.signer.getAddress())).toString()
    }

    // and send txs till last submitted epoch is less than one day old
    let _epochs = [...Array(MAX_EPOCHS_PER_TRANSACTION_TO_SUBMIT).keys()]
      .map((a) => parseInt(lastSubmittedEpoch) + a + 1)
      .map((a) => a.toString())

    _epochs = _epochs.filter(async (epoch) => {
      return await this.contractCache.checkIfTicketIsIssued(epoch)
    })

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
    let ticketData = await this.fetchSelectedTicketData(networkId, _epochs)

    // // only for testing
    // let ticketData = await this.fetchAllTicketData(networkId, _epochs)

    // select epochs that have atleast one cluster present, then normalize the data
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
      return [await this.signer.provider.sendTransaction(signedTx), TRANSACTION_WAIT_TIME]
    } else {
      console.log('No epoch data found')
      return [null, repeatEveryMs]
    }
  }
  // Core functions ends

  // Helper functions start
  private async checkForPendingTransaction (): Promise<[TransactionResponse | null, number]> {
    const lastOperationData = await this.db.getLastOperationData()

    // if this was no operation before, then nothing pending to check
    if (lastOperationData.length == 0) return [null, 1]

    // check if last operation is complete
    const pendingTx = lastOperationData[0].data
    const tx = utils.parseTransaction(pendingTx)
    const receipt = await this.signer.provider.getTransactionReceipt(tx.hash)

    if (receipt?.status) {
      // if receipt exists and status is true, and move to next operation immediately
      return [null, 1]
    }
    // receipt does not exist, i.e, it is not mined or tx failed and status is false
    // TODO - Figure out what to do in case tx fails (retry ?)

    // to avoid any edge case, manually check if all the epochs in the given transaction are included
    let atLeastIsAlreadySubmitted: boolean = false
    for (let index = 0; index < lastOperationData.length; index++) {
      const data = lastOperationData[index]
      const isSubmitted = await this.contractCache.checkIfTicketIsIssued(data.epoch.toString())

      if (isSubmitted) {
        await this.db.deleteEpoch(data.epoch)
        atLeastIsAlreadySubmitted = true
      }
    }

    // repeat the process once again (this will clean up all junk epochs)
    if (atLeastIsAlreadySubmitted) {
      return [null, 1]
    }

    const txCount = await this.signer.getTransactionCount()
    console.log('receipt is not mined')
    console.log({ atLeastIsAlreadySubmitted, txCount, 'tx.nonce': tx.nonce })
    if (txCount > tx.nonce) {
      // means transaction will never get mined, move to next operation
      await this.db.deleteOperation(lastOperationData[0].operation)
      return [null, 1]
    }
    
    if (txCount !== tx.nonce) { return [null, TRANSACTION_WAIT_TIME] }
    
    // this means transaction is unmined and it's gas price can be increased
    const gasPrice = await this.signer.getGasPrice()
    const newTx = getUnsignedTransactionFromSignedTransaction(tx, gasPrice, GAS_PRICE_INCREMENT)
    const populatedTransaction = await this.signer.populateTransaction(newTx)
    const signedTx = await this.signer.signTransaction(populatedTransaction)

    // console.log({ signedTx: utils.parseTransaction(signedTx) })
    await this.db.deleteOperation(lastOperationData[0].operation)

    for (let index = 0; index < lastOperationData.length; index++) {
      const element = lastOperationData[index]
      await this.db.savePendingTransaction(element.operation, element.epoch, signedTx)
    }

    // // un-comment this to see how the transaction is constructed
    // await this.signer.sendTransaction(utils.parseTransaction(signedTx))

    return [await this.signer.provider.sendTransaction(signedTx), TRANSACTION_WAIT_TIME]
  }

  public async fetchSelectedTicketData (_networkId, _epochs: string[]): Promise<Epoch[]> {
    this.if_init()
    let ticketData = await this.fetchAllTicketData(_networkId, _epochs)
    const clustersToSelect: string[][] = await Promise.all(
      _epochs.map(async (a) => await this.contractCache.getSelectedClusters(_networkId, a))
    )
    ticketData = filterTicketData(ticketData, clustersToSelect)
    return ticketData
  }

  public async lastSubmitedEpochAsPerLocalDb (): Promise<string | null> {
    this.if_init()
    const result = await this.db.getLastOperationData()
    if (result.length > 0) {
      return result[0].epoch.toString()
    } else {
      return null
    }
  }

  public async fetchAllTicketData (_networkId: string, _epochs: string[]): Promise<Epoch[]> {
    this.if_init()
    const epochEndTimes: number[] = []
    for (let index = 0; index < _epochs.length; index++) {
      const element = _epochs[index]
      const [, epochEndTime] = await this.contractCache.getEpochTime(element)
      epochEndTimes.push(epochEndTime)
    }
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
  // Helper functions ends
}
