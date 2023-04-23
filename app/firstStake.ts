import { Address, DataI, Hash28, PAddress, PaymentCredentials, Value, dataToCbor, pData, pDataB, pDataI } from "@harmoniclabs/plu-ts";
import { fakeLpTokenPolicy } from "../src/policies/fakeLpTokenPolicy";
import { cli } from "./utils/cli";
import { existsSync } from "fs";
import { PReserveDatum } from "../src/contracts/tedyYeildReserve";
import { readFile, writeFile } from "fs/promises";
import { fakeTEDYPolicy } from "../src/policies/fakeTEDYPolicy";
import { getStakeContractHash } from "./common/getStakeContractHash";
import { DatumOrRdmr } from "../src/contracts/liquidityStakingContract";
import { getFakeLpTokenHash } from "./common/getFakeLpTokenHash";

async function setup()
{
    const address = cli.utils.readAddress("./testnet/address1.addr");
    const privateKey = cli.utils.readPrivateKey("./testnet/payment1.skey");

    const stakeContract = cli.utils.readScript("./testnet/stakingContract.plutus.json");
    const stakeContractHash = stakeContract.hash;
    const stakeContractAddr = new Address(
        "testnet",
        PaymentCredentials.script( stakeContractHash )
    );

    const utxos = await cli.query.utxo({ address });

    const collaterals = [ utxos[0] ];

    const uniqueAssetNameAscii =
    Buffer.from(
        dataToCbor( utxos[0].utxoRef.toData() ).toBuffer()
    )
    .toString("ascii");

    const mintedValue = new Value([
        {
            policy: stakeContractHash,
            assets: { [uniqueAssetNameAscii]: 1 }
        }
    ]);

    const fakeLpTokenHash: Hash28 = await getFakeLpTokenHash();

    let tx = await cli.transaction.build({
        inputs: utxos.map( utxo => ({ utxo })) as any,
        collaterals,
        mints: [
            {
                script: {
                    inline: stakeContract,
                    policyId: stakeContractHash,
                    redeemer: DatumOrRdmr.MintRedeemer({
                        address: pData( address.toData() ),
                        lpSym:  pDataB( fakeLpTokenHash.toBuffer() ),
                        lpName: pDataB( Buffer.from("lp","utf-8") ),
                        outToStakeContractIdx: pDataI( 1 ), // first is change address
                    })
                },
                value: mintedValue
            }
        ],
        outputs: [
            {
                address: stakeContractAddr,
                datum: DatumOrRdmr.StakingDatum({
                    ownerAddr: pData( address.toData() ),
                    lpSym:  pDataB( fakeLpTokenHash.toBuffer() ),
                    lpName: pDataB( Buffer.from("lp","utf-8") ),
                    since: pDataI( 0 )
                }),
                value: Value.add(
                    Value.lovelaces( 2_000_000 ),
                    mintedValue
                )
            }
        ],
        changeAddress: address
    })
}
setup();