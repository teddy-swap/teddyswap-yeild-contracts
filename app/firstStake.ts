import { Address, DataI, Hash28, PAddress, PaymentCredentials, Value, dataToCbor, pData, pDataB, pDataI } from "@harmoniclabs/plu-ts";
import { cli } from "./utils/cli";
import { DatumOrRdmr } from "../src/contracts/liquidityStakingContract";
import { getFakeLpTokenHash } from "./common/getFakeLpTokenHash";
import { slotToPOSIX } from "./utils/slotToPOSIX";

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

    // 1000 slot form now is ~ 10 secs in private testnet
    const upperBoundSlot = cli.query.tipSync().slot + 1_000;

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
                    since: pDataI( await slotToPOSIX( upperBoundSlot ) )
                }),
                value: Value.add(
                    Value.lovelaces( 2_000_000 ),
                    mintedValue
                )
            }
        ],
        invalidAfter: upperBoundSlot,
        changeAddress: address
    });

    tx = await cli.transaction.sign({ tx, privateKey });

    await cli.transaction.submit({ tx });
}
setup();