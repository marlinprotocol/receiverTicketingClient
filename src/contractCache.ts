import { ReceiverStaking__factory } from './generated/factory/ReceiverStaking__factory'
import { type ReceiverStaking } from './generated/ReceiverStaking'

import { IClusterSelector__factory } from './generated/factory/IClusterSelector__factory'

import { ClusterRewards__factory } from './generated/factory/ClusterRewards__factory'
import { type ClusterRewards } from './generated/ClusterRewards'

import { BigNumber, type BigNumberish, type Signer } from 'ethers'
import { type AllClusterSelectors, type ClusterSelector, type SelectedClustersListPerNetwork } from './types'

export class ContractCache {
  public START_TIME: number
  public EPOCH_LENGTH: number
  public receiver: string

  private initialized: string

  private readonly signer: Signer
  private readonly receiverStaking: ReceiverStaking
  private readonly clusterRewards: ClusterRewards
  private readonly allClusterSelectors: AllClusterSelectors = {}

  private selectedNodesPerNetwork: SelectedClustersListPerNetwork = {}

  constructor (receiverStakingAddress: string, clusterRewardAddress: string, clusterSelectors: ClusterSelector[], signer: Signer) {
    this.receiverStaking = ReceiverStaking__factory.connect(receiverStakingAddress, signer)
    this.clusterRewards = ClusterRewards__factory.connect(clusterRewardAddress, signer)
    this.signer = signer

    for (let index = 0; index < clusterSelectors.length; index++) {
      const element = clusterSelectors[index]
      this.allClusterSelectors[element.networkId] = IClusterSelector__factory.connect(element.contractAddress, signer)
    }
  }

  public async init (): Promise<void> {
    this.receiver = await this.receiverStaking.signerToStaker(this.signer.getAddress())
    this.START_TIME = (await this.receiverStaking.callStatic.START_TIME()).toNumber()
    this.EPOCH_LENGTH = (await this.receiverStaking.callStatic.EPOCH_LENGTH()).toNumber()
  }

  public if_init (): void {
    if (!this.initialized) throw new Error('Not initialized, call object.init(), before using')
  }

  public async getEpochTime (epochNumber: BigNumberish): Promise<[number, number]> {
    this.if_init()    

    const epochStartTime = BigNumber.from(epochNumber).mul(this.EPOCH_LENGTH).add(this.START_TIME).toNumber()
    const epochEndTime = BigNumber.from(epochNumber).add(1).mul(this.EPOCH_LENGTH).add(this.START_TIME).toNumber()

    return [epochStartTime, epochEndTime]
  }

  public async getSelectedClusters (networkId: string, epoch: BigNumberish): Promise<string[]> {
    const clusterSelector = this.allClusterSelectors[networkId]
    if (!clusterSelector) {
      throw new Error('epoch selector not available for given network')
    }

    if (!this.selectedNodesPerNetwork[networkId]) {
      this.selectedNodesPerNetwork[networkId] = {}
    }

    epoch = BigNumber.from(epoch).toNumber()

    if (this.selectedNodesPerNetwork[networkId][epoch]) {
      return this.selectedNodesPerNetwork[networkId][epoch]
    }

    const selectedNodes = await clusterSelector.callStatic.getClusters(epoch)
    this.selectedNodesPerNetwork[networkId][epoch] = selectedNodes
    return selectedNodes
  }

  // call this function if selected epochs are already known
  public updateSelectedClustersExternally (networkId: string, epochs: BigNumberish[], clusters: string[][]): void {
    if (epochs.length !== clusters.length) {
      throw new Error('epoch.length and clusters.length should be same')
    }
    if (!this.selectedNodesPerNetwork[networkId]) {
      this.selectedNodesPerNetwork[networkId] = {}
    }

    for (let index = 0; index < epochs.length; index++) {
      const epoch = BigNumber.from(epochs[index]).toNumber()
      if (!this.selectedNodesPerNetwork[networkId][epoch]) {
        this.selectedNodesPerNetwork[networkId][epoch] = clusters[index].map((a) => a.toLowerCase())
      }
    }
  }

  public async checkIfTicketIsIssued (epoch: string): Promise<boolean> {
    this.if_init();
    
    try {
      return await this.clusterRewards.callStatic.isTicketsIssued(this.receiver, epoch)
    } catch (ex) {
      return false
    }
  }

  public async getLatestEpoch (): Promise<number> {
    // TODO: try to fetch info without contract
    const [, latestEpoch] = await this.receiverStaking.callStatic.getEpochInfo(1)

    return latestEpoch.toNumber()
  }
}
