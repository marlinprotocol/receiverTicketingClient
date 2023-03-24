import { type UnsignedTransaction, type BigNumberish, BigNumber, type Transaction, type BytesLike } from 'ethers'
import fetch from 'node-fetch'

import { type Epoch } from './types'
import { type PromiseOrValue } from './generated/common'

const tenE18 = BigNumber.from(10).pow(18)
const tenE36 = BigNumber.from(10).pow(36)

export async function fetchData (requestData: any): Promise<any> {
  const data = await fetch(requestData.url, { headers: requestData.headers, method: requestData.method, body: requestData.body })
  return data
}

function filterClusterAndTickets (
  _networkId: string,
  _epoch: string,
  allClusters: string[],
  allTickets: string[],
  selectedClusters: string[]
): Epoch {
  const _tickets: string[] = []

  selectedClusters = selectedClusters.map((a) => a.toLowerCase())

  for (let index = 0; index < selectedClusters.length; index++) {
    const cluster = selectedClusters[index]
    const selectedClusterIndex = allClusters.indexOf(cluster)

    let selectedClusterTickets = '0'
    if (index !== -1) {
      selectedClusterTickets = allTickets[selectedClusterIndex]
    }

    _tickets.push(selectedClusterTickets)
  }

  return {
    _networkId,
    _epoch,
    _clusters: selectedClusters,
    _tickets
  }
}

export function filterTicketData (epochs: Epoch[], clustersToSelect: string[][]): Epoch[] {
  if (epochs.length !== clustersToSelect.length) {
    throw new Error('Arity mismatch')
  }

  const toReturn: Epoch[] = []
  for (let index = 0; index < epochs.length; index++) {
    const epoch = epochs[index]
    const selectedClusters = clustersToSelect[index]

    toReturn.push(filterClusterAndTickets(epoch._networkId, epoch._epoch, epoch._clusters, epoch._tickets, selectedClusters))
  }

  return toReturn
}

export function getUnsignedTransactionFromSignedTransaction (
  tx: Transaction,
  gasPrice: BigNumberish,
  gasLimitMultiplier: BigNumberish
): UnsignedTransaction {
  const newGasPrice = BigNumber.from(gasPrice).mul(gasLimitMultiplier).div(100)

  // console.log({ tx })

  const newTx = {
    nonce: tx.nonce,
    gasPrice: newGasPrice,
    gasLimit: tx.gasLimit,
    to: tx.to,
    value: tx.value,
    data: tx.data
    // chainId: tx.chainId,

    // Typed-Transaction features
    // type: tx.type

    // EIP-2930; Type 1 & EIP-1559; Type 2
    // accessList: tx.accessList,

    // EIP-1559; Type 2
    // maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    // maxFeePerGas: tx.maxFeePerGas
  }

  // const newTx = { ...tx, gasLimit, maxFeePerGas: newGasPrice }

  // delete newTx.v
  // delete newTx.r
  // delete newTx.s
  // delete newTx.hash
  // delete newTx.type
  // delete newTx.chainId

  // console.log({ newTx })
  return newTx
}

export const induceDelay = async (ms: number = 1000): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export const normalizeTicketData = (epoch: Epoch): Epoch => {
  const total = epoch._tickets.reduce((total, current) => total.add(current), BigNumber.from(0))

  // multiplely the scale by large number and divide at end to reduce the precision loss
  const scale = tenE18.mul(tenE36).div(total)

  const tickets: BigNumber[] = epoch._tickets.map((a) => scale.mul(a)).map((a) => a.div(tenE36))
  const sum = tickets.reduce((prev, current) => prev.add(current), BigNumber.from(0))
  const diff = tenE18.sub(sum)

  tickets[0] = tickets[0].add(diff)

  const updatedSum = tickets.reduce((prev, current) => prev.add(current), BigNumber.from(0))

  if (!updatedSum.eq(tenE18)) {
    throw new Error('Failed ticker normalisation')
  }

  return {
    ...epoch,
    _tickets: tickets.map((a) => a.toString())
  }
}

export const generateTicketBytesForEpoch = (
  _networkId: PromiseOrValue<BytesLike>,
  _epoch: PromiseOrValue<BigNumberish>,
  _tickets: Array<PromiseOrValue<BigNumberish>>
): BytesLike => {
  // TODO: create bytes from the input arguments
  return '0x1234'
}

export const generateTicketBytesForEpochs = (
  _networkId: PromiseOrValue<BytesLike>,
  _epoch: Array<PromiseOrValue<BigNumberish>>,
  _tickets: Array<Array<PromiseOrValue<BigNumberish>>>
): BytesLike => {
  // TODO: create bytes from the input arguments
  return '0x1234'
}
