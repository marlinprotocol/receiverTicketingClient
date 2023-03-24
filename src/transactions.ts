import { type ClusterRewards } from './generated/ClusterRewards'
import { ClusterRewards__factory } from './generated/factory/ClusterRewards__factory'

import type { BigNumberish, BytesLike, ContractTransaction, Overrides, PopulatedTransaction, Signer } from 'ethers'

import { type PromiseOrValue } from './generated/common'
import { generateTicketBytesForEpoch, generateTicketBytesForEpochs } from './helper'

const submitTicketForEpoch = async (
  signer: Signer,
  contractAddress: string,
  _networkId: PromiseOrValue<BytesLike>,
  _epoch: PromiseOrValue<BigNumberish>,
  _tickets: Array<PromiseOrValue<BigNumberish>>,
  overrides?: Overrides
): Promise<ContractTransaction> => {
  const ticketBytes = generateTicketBytesForEpoch(_networkId, _epoch, _tickets)
  const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
  return await clusterRewards['issueTickets(bytes)'](ticketBytes, { ...overrides })
}

const submitTicketForEpochs = async (
  signer: Signer,
  contractAddress: string,
  _networkId: PromiseOrValue<BytesLike>,
  _epoch: Array<PromiseOrValue<BigNumberish>>,
  _tickets: Array<Array<PromiseOrValue<BigNumberish>>>,
  overrides?: Overrides
): Promise<ContractTransaction> => {
  const ticketBytes = generateTicketBytesForEpochs(_networkId, _epoch, _tickets)
  const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
  return await clusterRewards['issueTickets(bytes)'](ticketBytes, { ...overrides })
}

const createUnsignedTransaction = {
  submitTicketForEpoch: async (
    signer: Signer,
    contractAddress: string,
    _networkId: PromiseOrValue<BytesLike>,
    _epoch: PromiseOrValue<BigNumberish>,
    _tickets: Array<PromiseOrValue<BigNumberish>>,
    overrides?: Overrides
  ): Promise<PopulatedTransaction> => {
    const ticketBytes = generateTicketBytesForEpoch(_networkId, _epoch, _tickets)
    const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
    return await clusterRewards.populateTransaction['issueTickets(bytes)'](ticketBytes, {
      ...overrides
    })
  },
  submitTicketForEpochs: async (
    signer: Signer,
    contractAddress: string,
    _networkId: PromiseOrValue<BytesLike>,
    _epoch: Array<PromiseOrValue<BigNumberish>>,
    _tickets: Array<Array<PromiseOrValue<BigNumberish>>>,
    overrides?: Overrides
  ): Promise<PopulatedTransaction> => {
    const ticketBytes = generateTicketBytesForEpochs(_networkId, _epoch, _tickets)
    const clusterRewards: ClusterRewards = ClusterRewards__factory.connect(contractAddress, signer)
    return await clusterRewards.populateTransaction['issueTickets(bytes)'](ticketBytes, {
      ...overrides
    })
  }
}

export { submitTicketForEpoch, submitTicketForEpochs, createUnsignedTransaction }
