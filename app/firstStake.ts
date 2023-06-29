import { Address, Hash28, PAddress, PaymentCredentials, TxBuilder, Value, dataToCbor, pData, pDataB, pDataI } from "@harmoniclabs/plu-ts";
import { cli } from "./utils/cli";
import { DatumOrRdmr } from "../src/contracts/liquidityStakingContract";
import { getFakeLpTokenHash } from "./common/getFakeLpTokenHash";
import { slotToPOSIX } from "./utils/slotToPOSIX";
import { toHex } from "@harmoniclabs/uint8array-utils";
import { getNetworkStartPOSIX } from "./utils/getNetworkStartPOSIX";
import { getSlotLengthMs } from "./utils/getSlotLengthMs";
import { idiv } from "./utils/idiv";
import { blake2b_256 } from "@harmoniclabs/crypto";

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

    let totCollateral = BigInt(0);
    const collaterals = utxos.filter( u => {

        if( totCollateral >= 5_000_000 ) return false;
        
        const value = u.resolved.value;
        const lovelaces = value.lovelaces;

        if( lovelaces >= 2_000_000 )
        {
            totCollateral += lovelaces;
            return true;
        }
    });

    const theChosenUtxo = utxos[0].utxoRef;

    const utxoCbor = dataToCbor( theChosenUtxo.toData() ).toBuffer()
        
    const uniqueAssetNameBuff = blake2b_256( new Uint8Array([ theChosenUtxo.index, ...theChosenUtxo.id.toBuffer() ]) );

    const mintedValue = new Value([
        Value.singleAssetEntry(
            stakeContractHash,
            uniqueAssetNameBuff,
            1
        )
    ]);

    const fakeLpTokenHash: Hash28 = await getFakeLpTokenHash();

    // 1000 slot form now is ~ 10 secs in private testnet
    const upperBoundSlot = cli.query.tipSync().slot + 300;

    const [ start, sLen ] = await Promise.all([
        getNetworkStartPOSIX(),
        getSlotLengthMs()
    ]);
    
    const txBuilder = new TxBuilder(
        "testnet",
        cli.query.protocolParametersSync(),
        {
            systemStartPOSIX: start,
            slotLengthInMilliseconds: sLen
        }
    );

    const upperBoundPOSIX = await slotToPOSIX( upperBoundSlot );
    const upperBoundTime = idiv( upperBoundPOSIX, 86_400_000 );

    console.log();
    console.log( toHex( utxoCbor ) );
    console.log();

    let tx = await cli.transaction.build({
        inputs: utxos.map( utxo => ({ utxo })) as any,
        collaterals,
        collateralReturn: {
            address: address,
            value: Value.sub(
                collaterals[0].resolved.value,
                Value.lovelaces( 30_000_000 )
            )
        },
        mints: [
            {
                script: {
                    inline: stakeContract,
                    policyId: stakeContractHash,
                    redeemer: DatumOrRdmr.MintRedeemer({
                        address: PAddress.fromData( pData( address.toData() ) ) as any,
                        lpSym:  pDataB( fakeLpTokenHash.toBuffer() ),
                        lpName: pDataB( Buffer.from("lp","utf-8") ),
                        outToStakeContractIdx: pDataI( 1 ), // plu-ts tx builder change address is last
                    })
                },
                value: mintedValue
            }
        ],
        outputs: [
            {
                address: stakeContractAddr,
                datum: DatumOrRdmr.StakingDatum({
                    ownerAddr: PAddress.fromData( pData( address.toData() ) ) as any,
                    since:  pDataI( upperBoundTime ),
                    lpSym:  pDataB( fakeLpTokenHash.toBuffer() ),
                    lpName: pDataB( Buffer.from("lp","utf-8") ),
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
setup();0