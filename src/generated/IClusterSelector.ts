/* Autogenerated file. Do not edit manually. */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from 'ethers'
import type { FunctionFragment, Result } from '@ethersproject/abi'
import type { Listener, Provider } from '@ethersproject/providers'
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent, PromiseOrValue } from './common'

export interface IClusterSelectorInterface extends utils.Interface {
  functions: {
    'EPOCH_LENGTH()': FunctionFragment
    'START_TIME()': FunctionFragment
    'deleteIfPresent(address)': FunctionFragment
    'delete_unchecked(address)': FunctionFragment
    'getClusters(uint256)': FunctionFragment
    'getCurrentEpoch()': FunctionFragment
    'insertMultiple_unchecked(address[],uint64[])': FunctionFragment
    'insert_unchecked(address,uint64)': FunctionFragment
    'selectClusters()': FunctionFragment
    'updateNumberOfClustersToSelect(uint256)': FunctionFragment
    'update_unchecked(address,uint64)': FunctionFragment
    'upsert(address,uint64)': FunctionFragment
    'upsertMultiple(address[],uint64[])': FunctionFragment
  }

  getFunction(
    nameOrSignatureOrTopic:
      | 'EPOCH_LENGTH'
      | 'START_TIME'
      | 'deleteIfPresent'
      | 'delete_unchecked'
      | 'getClusters'
      | 'getCurrentEpoch'
      | 'insertMultiple_unchecked'
      | 'insert_unchecked'
      | 'selectClusters'
      | 'updateNumberOfClustersToSelect'
      | 'update_unchecked'
      | 'upsert'
      | 'upsertMultiple'
  ): FunctionFragment

  encodeFunctionData(functionFragment: 'EPOCH_LENGTH', values?: undefined): string
  encodeFunctionData(functionFragment: 'START_TIME', values?: undefined): string
  encodeFunctionData(functionFragment: 'deleteIfPresent', values: [PromiseOrValue<string>]): string
  encodeFunctionData(functionFragment: 'delete_unchecked', values: [PromiseOrValue<string>]): string
  encodeFunctionData(functionFragment: 'getClusters', values: [PromiseOrValue<BigNumberish>]): string
  encodeFunctionData(functionFragment: 'getCurrentEpoch', values?: undefined): string
  encodeFunctionData(
    functionFragment: 'insertMultiple_unchecked',
    values: [PromiseOrValue<string>[], PromiseOrValue<BigNumberish>[]]
  ): string
  encodeFunctionData(functionFragment: 'insert_unchecked', values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]): string
  encodeFunctionData(functionFragment: 'selectClusters', values?: undefined): string
  encodeFunctionData(functionFragment: 'updateNumberOfClustersToSelect', values: [PromiseOrValue<BigNumberish>]): string
  encodeFunctionData(functionFragment: 'update_unchecked', values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]): string
  encodeFunctionData(functionFragment: 'upsert', values: [PromiseOrValue<string>, PromiseOrValue<BigNumberish>]): string
  encodeFunctionData(functionFragment: 'upsertMultiple', values: [PromiseOrValue<string>[], PromiseOrValue<BigNumberish>[]]): string

  decodeFunctionResult(functionFragment: 'EPOCH_LENGTH', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'START_TIME', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'deleteIfPresent', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'delete_unchecked', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'getClusters', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'getCurrentEpoch', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'insertMultiple_unchecked', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'insert_unchecked', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'selectClusters', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'updateNumberOfClustersToSelect', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'update_unchecked', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'upsert', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'upsertMultiple', data: BytesLike): Result

  events: {}
}

export interface IClusterSelector extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this
  attach(addressOrName: string): this
  deployed(): Promise<this>

  interface: IClusterSelectorInterface

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>

  listeners<TEvent extends TypedEvent>(eventFilter?: TypedEventFilter<TEvent>): Array<TypedListener<TEvent>>
  listeners(eventName?: string): Array<Listener>
  removeAllListeners<TEvent extends TypedEvent>(eventFilter: TypedEventFilter<TEvent>): this
  removeAllListeners(eventName?: string): this
  off: OnEvent<this>
  on: OnEvent<this>
  once: OnEvent<this>
  removeListener: OnEvent<this>

  functions: {
    EPOCH_LENGTH(overrides?: CallOverrides): Promise<[BigNumber]>

    START_TIME(overrides?: CallOverrides): Promise<[BigNumber]>

    deleteIfPresent(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>

    delete_unchecked(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>

    getClusters(epoch: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<[string[]] & { clusters: string[] }>

    getCurrentEpoch(overrides?: CallOverrides): Promise<[BigNumber]>

    insertMultiple_unchecked(
      newNodes: PromiseOrValue<string>[],
      balances: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>

    insert_unchecked(
      newNode: PromiseOrValue<string>,
      balance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>

    selectClusters(overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>

    updateNumberOfClustersToSelect(
      numberOfClusters: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>

    update_unchecked(
      cluster: PromiseOrValue<string>,
      clusterBalance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>

    upsert(
      newNode: PromiseOrValue<string>,
      balance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>

    upsertMultiple(
      newNodes: PromiseOrValue<string>[],
      balances: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>
  }

  EPOCH_LENGTH(overrides?: CallOverrides): Promise<BigNumber>

  START_TIME(overrides?: CallOverrides): Promise<BigNumber>

  deleteIfPresent(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>

  delete_unchecked(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>

  getClusters(epoch: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<string[]>

  getCurrentEpoch(overrides?: CallOverrides): Promise<BigNumber>

  insertMultiple_unchecked(
    newNodes: PromiseOrValue<string>[],
    balances: PromiseOrValue<BigNumberish>[],
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>

  insert_unchecked(
    newNode: PromiseOrValue<string>,
    balance: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>

  selectClusters(overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<ContractTransaction>

  updateNumberOfClustersToSelect(
    numberOfClusters: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>

  update_unchecked(
    cluster: PromiseOrValue<string>,
    clusterBalance: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>

  upsert(
    newNode: PromiseOrValue<string>,
    balance: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>

  upsertMultiple(
    newNodes: PromiseOrValue<string>[],
    balances: PromiseOrValue<BigNumberish>[],
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>

  callStatic: {
    EPOCH_LENGTH(overrides?: CallOverrides): Promise<BigNumber>

    START_TIME(overrides?: CallOverrides): Promise<BigNumber>

    deleteIfPresent(key: PromiseOrValue<string>, overrides?: CallOverrides): Promise<void>

    delete_unchecked(key: PromiseOrValue<string>, overrides?: CallOverrides): Promise<void>

    getClusters(epoch: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<string[]>

    getCurrentEpoch(overrides?: CallOverrides): Promise<BigNumber>

    insertMultiple_unchecked(
      newNodes: PromiseOrValue<string>[],
      balances: PromiseOrValue<BigNumberish>[],
      overrides?: CallOverrides
    ): Promise<void>

    insert_unchecked(newNode: PromiseOrValue<string>, balance: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<void>

    selectClusters(overrides?: CallOverrides): Promise<string[]>

    updateNumberOfClustersToSelect(numberOfClusters: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<void>

    update_unchecked(
      cluster: PromiseOrValue<string>,
      clusterBalance: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>

    upsert(newNode: PromiseOrValue<string>, balance: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<void>

    upsertMultiple(newNodes: PromiseOrValue<string>[], balances: PromiseOrValue<BigNumberish>[], overrides?: CallOverrides): Promise<void>
  }

  filters: {}

  estimateGas: {
    EPOCH_LENGTH(overrides?: CallOverrides): Promise<BigNumber>

    START_TIME(overrides?: CallOverrides): Promise<BigNumber>

    deleteIfPresent(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>

    delete_unchecked(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>

    getClusters(epoch: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<BigNumber>

    getCurrentEpoch(overrides?: CallOverrides): Promise<BigNumber>

    insertMultiple_unchecked(
      newNodes: PromiseOrValue<string>[],
      balances: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>

    insert_unchecked(
      newNode: PromiseOrValue<string>,
      balance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>

    selectClusters(overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<BigNumber>

    updateNumberOfClustersToSelect(
      numberOfClusters: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>

    update_unchecked(
      cluster: PromiseOrValue<string>,
      clusterBalance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>

    upsert(
      newNode: PromiseOrValue<string>,
      balance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>

    upsertMultiple(
      newNodes: PromiseOrValue<string>[],
      balances: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>
  }

  populateTransaction: {
    EPOCH_LENGTH(overrides?: CallOverrides): Promise<PopulatedTransaction>

    START_TIME(overrides?: CallOverrides): Promise<PopulatedTransaction>

    deleteIfPresent(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>

    delete_unchecked(key: PromiseOrValue<string>, overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>

    getClusters(epoch: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<PopulatedTransaction>

    getCurrentEpoch(overrides?: CallOverrides): Promise<PopulatedTransaction>

    insertMultiple_unchecked(
      newNodes: PromiseOrValue<string>[],
      balances: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>

    insert_unchecked(
      newNode: PromiseOrValue<string>,
      balance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>

    selectClusters(overrides?: Overrides & { from?: PromiseOrValue<string> }): Promise<PopulatedTransaction>

    updateNumberOfClustersToSelect(
      numberOfClusters: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>

    update_unchecked(
      cluster: PromiseOrValue<string>,
      clusterBalance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>

    upsert(
      newNode: PromiseOrValue<string>,
      balance: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>

    upsertMultiple(
      newNodes: PromiseOrValue<string>[],
      balances: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>
  }
}
