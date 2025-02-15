import { poolInfo } from "../../common/maps.js";
import {
  AlphaFiVaultBalance,
  PoolName,
  SingleAssetPoolNames,
} from "../../common/types.js";
import { getSuiClient } from "../client.js";
import {
  getAlphaPortfolioAmount,
  getAlphaPortfolioAmountInUSD,
  getPortfolioAmount,
  getDoubleAssetPortfolioAmountInUSD,
  getSingleAssetPortfolioAmount,
  getSingleAssetPortfolioAmountInUSD,
} from "./getPortfolioAmounts.js";

export async function fetchUserVaultBalances(
  address: string,
  poolName: PoolName,
  ignoreCache: boolean,
  ignoreUsd: boolean = false,
): Promise<AlphaFiVaultBalance | undefined> {
  const suiClient = getSuiClient();

  let vaultBalance: AlphaFiVaultBalance | undefined;
  if (poolInfo[poolName].parentProtocolName === "ALPHAFI") {
    const lockedPortfolioAmount = await getAlphaPortfolioAmount(
      "ALPHA",
      {
        suiClient,
        address,
        isLocked: true,
      },
      ignoreCache,
    );
    const lockedPortfolioAmountInUSD = !ignoreUsd
      ? await getAlphaPortfolioAmountInUSD(
          "ALPHA",
          { suiClient, address, isLocked: true },
          ignoreCache,
        )
      : "0";
    const unlockedPortfolioAmount = await getAlphaPortfolioAmount(
      "ALPHA",
      {
        suiClient,
        address,
        isLocked: false,
      },
      ignoreCache,
    );
    const unlockedPortfolioAmountInUSD = !ignoreUsd
      ? await getAlphaPortfolioAmountInUSD(
          "ALPHA",
          { suiClient, address, isLocked: false },
          ignoreCache,
        )
      : "0";
    const portfolioAmount = await getAlphaPortfolioAmount(
      "ALPHA",
      {
        suiClient,
        address,
      },
      ignoreCache,
    );
    const portfolioAmountInUSD = !ignoreUsd
      ? await getAlphaPortfolioAmountInUSD(
          "ALPHA",
          {
            suiClient,
            address,
          },
          ignoreCache,
        )
      : "0";
    if (
      lockedPortfolioAmount !== undefined &&
      lockedPortfolioAmountInUSD !== undefined &&
      unlockedPortfolioAmount !== undefined &&
      unlockedPortfolioAmountInUSD !== undefined &&
      portfolioAmount !== undefined &&
      portfolioAmountInUSD !== undefined
    ) {
      const res: AlphaFiVaultBalance = {
        lockedAlphaCoins: lockedPortfolioAmount,
        lockedAlphaCoinsInUSD: lockedPortfolioAmountInUSD,
        unlockedAlphaCoins: unlockedPortfolioAmount,
        unlockedAlphaCoinsInUSD: unlockedPortfolioAmountInUSD,
        totalAlphaCoins: portfolioAmount,
        totalAlphaCoinsInUSD: portfolioAmountInUSD,
      };
      vaultBalance = res;
    }
  } else if (poolInfo[poolName].assetTypes.length === 2) {
    const portfolioAmount = await getPortfolioAmount(
      poolName as PoolName,
      address,
      ignoreCache,
    );
    const portfolioAmountInUSD = !ignoreUsd
      ? await getDoubleAssetPortfolioAmountInUSD(
          poolName as PoolName,
          address,
          ignoreCache,
        )
      : "0";
    if (portfolioAmount !== undefined && portfolioAmountInUSD !== undefined) {
      const res: AlphaFiVaultBalance = {
        coinA: portfolioAmount[0].toString(),
        coinB: portfolioAmount[1].toString(),
        valueInUSD: portfolioAmountInUSD,
      };
      vaultBalance = res;
    }
  } else if (poolInfo[poolName].assetTypes.length === 1) {
    const portfolioAmount = await getSingleAssetPortfolioAmount(
      poolName as SingleAssetPoolNames,
      address,
      ignoreCache,
    );
    const portfolioAmountInUSD = !ignoreUsd
      ? await getSingleAssetPortfolioAmountInUSD(
          poolName as SingleAssetPoolNames,
          address,
          ignoreCache,
        )
      : "0";
    if (portfolioAmount !== undefined && portfolioAmountInUSD !== undefined) {
      const res: AlphaFiVaultBalance = {
        coin: portfolioAmount.toString(),
        valueInUSD: portfolioAmountInUSD,
      };
      vaultBalance = res;
    }
  }
  return vaultBalance;
}
