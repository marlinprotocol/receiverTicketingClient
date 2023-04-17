import type { PoolConfig } from 'pg'
import type { IClusterSelector } from './generated/IClusterSelector'

export interface Operation {
  operation: number
  epoch: number
  hash: string
  data: string
}
export interface Epoch {
  networkId: string
  epoch: string
  clusters: string[]
  tickets: string[]
}

// used to match the return type from postgres
export interface ClusterQueryData {
  cluster: string
  count: string
}

export interface TicketConfig extends DataConfig {
  epochData: EpochData
  contractAddresses: ContractAddresses
}

export interface DataConfig {
  ticketConfig: PoolConfig
  receiverConfig: PoolConfig
  subgraphUrl: string
}

export interface EpochData {
  epochLengthInSeconds: number
}

export interface ContractAddresses {
  RewardDelegators: string
  StakeManager: string
  ClusterRegistry: string
  ClusterSelectors: ClusterSelector[]
  ReceiverStaking: string
  ClusterRewards: string
}

export interface ClusterSelector {
  name?: string
  networkId: string
  contractAddress: string
}

export interface SelectedClusterData {
  id: string
  address: string
  epoch: string
  networkId: string
}

export type SelectedClustersList = Record<number, string[]>
export type SelectedClustersListPerNetwork = Record<string, SelectedClustersList>
export type AllClusterSelectors = Record<string, IClusterSelector>
