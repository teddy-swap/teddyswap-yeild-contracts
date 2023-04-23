import { Hash28 } from "@harmoniclabs/plu-ts";
import { existsSync } from "fs";
import { cli } from "../utils/cli";
import { readFile, writeFile } from "fs/promises";

export async function getStakeContractHash(): Promise<Hash28>
{
    return ( existsSync("./testnet/stakingContract.hash") ) ?
    new Hash28( await readFile("./testnet/stakingContract.hash", { encoding: "utf-8"} ) ) :
    (() => {
        const stakeContractHash = cli.utils.readScript("./testnet/stakingContract.plutus.json").hash

        writeFile("./testnet/stakingContract.hash", stakeContractHash.toString(), { encoding: "utf-8"} );

        return stakeContractHash;
    })();
}