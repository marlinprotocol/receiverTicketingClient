import { type UnsignedTransaction, type BigNumberish, BigNumber, type Transaction, type BytesLike, utils } from 'ethers'
import fetch from 'node-fetch'

import { type Epoch } from './types'

const twoE16 = BigNumber.from(2).pow(16)
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
  const scale = twoE16.mul(tenE36).div(total)

  const tickets: BigNumber[] = epoch._tickets.map((a) => scale.mul(a)).map((a) => a.div(tenE36))
  const sum = tickets.reduce((prev, current) => prev.add(current), BigNumber.from(0))
  const diff = twoE16.sub(sum)

  tickets[0] = tickets[0].add(diff)

  const updatedSum = tickets.reduce((prev, current) => prev.add(current), BigNumber.from(0))

  if (!updatedSum.eq(twoE16)) {
    throw new Error('Failed ticker normalisation')
  }

  return {
    ...epoch,
    _tickets: tickets.map((a) => a.toString())
  }
}

const trimIfClusterMoreThanRequired = (ticketData: Epoch[], requiredClusters: number): Epoch[] => {
  return ticketData.map((a) => {
    return {
      ...a,
      _clusters: a._clusters.slice(0, requiredClusters),
      _tickets: a._tickets.slice(0, requiredClusters)
    }
  })
}

// assumes that the ticket data is already sorted in asc order of epochs
export const sortAndselectOnlyConsecutiveEpoch = (ticketData: Epoch[]): Epoch[] => {
  if (ticketData.length <= 1) {
    return ticketData
  }
  ticketData = ticketData.sort((a, b) => BigNumber.from(a._epoch).sub(BigNumber.from(b._epoch)).toNumber()) // sort the ticket data in ascending order of epochs

  const startEpoch = ticketData[0]

  const toReturn: Epoch[] = []
  toReturn.push(startEpoch)

  for (let index = 1; index < ticketData.length; index++) {
    const element = ticketData[index]
    const currentEpoch = element._epoch
    const lastEpoch = toReturn[toReturn.length - 1]._epoch

    if (BigNumber.from(lastEpoch).add(1).eq(BigNumber.from(currentEpoch))) {
      toReturn.push(element)
    } else {
      break
    }
  }

  return toReturn
}

export const generateTicketBytesForEpochs = (ticketData: Epoch[], maxClustersToSelect: number): BytesLike => {
  ticketData = trimIfClusterMoreThanRequired(ticketData, maxClustersToSelect)

  // Ticket Structure
  // |--NetworkId(256 bits)--|--FromEpoch(32 bits)--|--N*Ticket(16 bits)--|
  let toBytes: string = ''
  const networkId = ticketData[0]._networkId
  const startEpoch = BigNumber.from(ticketData[0]._epoch).toHexString()

  toBytes = toBytes + networkId + utils.hexZeroPad(startEpoch, 4).split('x')[1]

  for (let index = 0; index < ticketData.length; index++) {
    const element = ticketData[index]
    if (element._tickets.length === 0) {
      continue
    } else if (element._tickets.length < maxClustersToSelect - 1) {
      // todo
      const tickets = element._tickets
        .splice(0, maxClustersToSelect - 1)
        .map((a) => BigNumber.from(a).toHexString())
        .map((a) => utils.hexZeroPad(a, 2).split('x')[1])
        .reduce((prev, current) => prev + current, '')
      toBytes = toBytes + tickets

      const zeroPad = utils.hexZeroPad('0x0', 2).split('x')[1]
      const timesToPadZero = maxClustersToSelect - 1 - element._tickets.length

      for (let index = 0; index < timesToPadZero; index++) {
        toBytes = toBytes + zeroPad
      }
    } else {
      const tickets = element._tickets
        .splice(0, maxClustersToSelect - 1)
        .map((a) => BigNumber.from(a).toHexString())
        .map((a) => utils.hexZeroPad(a, 2).split('x')[1])
        .reduce((prev, current) => prev + current, '')
      toBytes = toBytes + tickets
    }
  }
  return toBytes
}
