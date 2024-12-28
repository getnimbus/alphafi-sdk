import { TickMath } from "@cetusprotocol/cetus-sui-clmm-sdk";
import {
  BluefinPoolType,
  CetusInvestor,
  CetusPoolType,
  CommonInvestorFields,
  PoolName,
  CoinName,
  MemberType,
  Allocator,
} from "./common/types.js";
import {
  getDistributor,
  getInvestor,
  getParentPool,
} from "./sui-sdk/functions/getReceipts.js";
import BN from "bn.js";
import { coinsList } from "./common/coins.js";
import { doubleAssetPoolCoinMap, poolInfo } from "./common/maps.js";
import { Decimal } from "decimal.js";
import { Transaction } from "@mysten/sui/transactions";
import { conf, CONF_ENV } from "./common/constants.js";

export async function getCurrentTick(poolName: PoolName) {
  const parentPool = await getParentPool(poolName, false);
  const current_sqrt_price = parentPool.content.fields.current_sqrt_price;
  const tick = TickMath.sqrtPriceX64ToTickIndex(new BN(current_sqrt_price));
  return tick.toString();
}

export async function getPositionTicks(poolName: PoolName) {
  const upperBound = 443636;
  const investor = (await getInvestor(poolName, false)) as CetusInvestor &
    CommonInvestorFields;
  let lowerTick = Number(investor.content.fields.lower_tick);
  let upperTick = Number(investor.content.fields.upper_tick);
  if (lowerTick > upperBound) {
    lowerTick = -~(lowerTick - 1);
  }
  if (upperTick > upperBound) {
    upperTick = -~(upperTick - 1);
  }
  return [lowerTick.toString(), upperTick.toString()];
}

export async function getTickToPrice(poolName: PoolName, tick: string) {
  const coinAName = doubleAssetPoolCoinMap[poolName].coin1;
  const coinA = coinsList[coinAName];
  const coinBName = doubleAssetPoolCoinMap[poolName].coin2;
  const coinB = coinsList[coinBName];
  const price = TickMath.tickIndexToPrice(Number(tick), coinA.expo, coinB.expo);
  return price.toString();
}

export async function getPriceToTick(poolName: PoolName, price: string) {
  const coinAName = doubleAssetPoolCoinMap[poolName].coin1;
  const coinA = coinsList[coinAName];
  const coinBName = doubleAssetPoolCoinMap[poolName].coin2;
  const coinB = coinsList[coinBName];
  const parentPool = await getParentPool(poolName, false);
  console.log(parentPool.content.fields);
  let tickSpacing = 1;
  if (poolInfo[poolName].parentProtocolName === "CETUS") {
    tickSpacing = (parentPool as CetusPoolType).content.fields.tick_spacing;
  } else if (poolInfo[poolName].parentProtocolName === "BLUEFIN") {
    tickSpacing = (parentPool as BluefinPoolType).content.fields.ticks_manager
      .fields.tick_spacing;
  }
  const priceDecimal = new Decimal(price);
  const tick = TickMath.priceToInitializableTickIndex(
    priceDecimal,
    coinA.expo,
    coinB.expo,
    tickSpacing,
  );
  return tick.toString();
}

export const setWeights = async (
  poolIdNames: string[],
  weightsString: string[],
  setWeightCoinType: CoinName,
  adminCap: string,
) => {
  const poolIds: string[] = [];
  const txb = new Transaction();
  poolIdNames.forEach((poolName) => {
    poolIds.push(poolInfo[poolName].poolId);
  });

  txb.moveCall({
    target: `${conf[CONF_ENV].ALPHA_LATEST_PACKAGE_ID}::distributor::set_weights`,
    typeArguments: [coinsList[setWeightCoinType].type],
    arguments: [
      txb.object(adminCap),
      txb.object(conf[CONF_ENV].ALPHA_DISTRIBUTOR),
      txb.object(conf[CONF_ENV].VERSION),
      txb.pure.vector("id", poolIds),
      txb.pure.vector("u64", weightsString),
      txb.object(conf[CONF_ENV].CLOCK_PACKAGE_ID),
    ],
  });

  // executeTransactionBlock(txb);
  // dryRunTransactionBlock(txb);
  return txb;
};
export async function getPoolsWeightDistribution(
  ignoreCache: boolean,
  poolNames: string[],
) {
  const distributor = await getDistributor(ignoreCache);
  if (!distributor || !distributor.content.fields.pool_allocator) {
    throw new Error("Distributor or pool allocator not found");
  }
  const allocator: Allocator = distributor.content.fields.pool_allocator;
  const members: MemberType[] = allocator.fields.members.fields.contents;

  const totalWeightArr = allocator.fields.total_weights.fields.contents;
  const totalWeight = Number(totalWeightArr[1].fields.value);

  const results: {
    poolName: string;
    weight: number;
    totalWeight: number;
    currentWeightPercentage: string;
  }[] = [];

  for (const poolName of poolNames) {
    const poolId = poolInfo[poolName]?.poolId;
    if (!poolId) {
      results.push({
        poolName,
        weight: 0,
        totalWeight,
        currentWeightPercentage: "0.00%",
      });
      continue;
    }

    const poolMember = members.find((member) => member.fields.key === poolId);

    const weight =
      Number(
        poolMember?.fields.value.fields.pool_data.fields.contents.at(-1)?.fields
          .value.fields.weight,
      ) || 0;
    const rawPercentage = totalWeight === 0 ? 0 : (weight / totalWeight) * 100;
    const currentWeightPercentage = `${rawPercentage.toFixed(2)}%`;

    results.push({
      poolName,
      weight,
      totalWeight,
      currentWeightPercentage,
    });
  }

  return results;
}
