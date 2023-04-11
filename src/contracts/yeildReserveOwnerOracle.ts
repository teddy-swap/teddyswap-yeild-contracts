import { PCredential, POutputDatum, PScriptContext, PTxInInfo, PTxInfo, PTxOutRef, Script, bool, bs, compile, int, makeValidator, pBool, perror, pfn, phoist, plam, plet, pmatch, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";
import { getOutCreds } from "../utils/getOutCreds";

const PYeildOwnerRedeemer = pstruct({
    ChangeOwner: {
        newOwner: PCredential.type,
        ownInputIdx: int
    }
})

const getInputPaymentCreds = phoist(
    plam( PTxInInfo.type, PCredential.type )
    ( input => getOutCreds.$( input.resolved ) )
)
/**
 * since ownership is updated with current owner consent
 * we do not require additional restrictions ( such as identifying nfts here )
 * 
 * however these might be required and checked by other contracts
 * 
 * (as in the case of the reserve)
 */
export const yeildReserveOwnerOracle = pfn([
    // owner
    // likely a multi-sig at the beginning;
    // upgraded to community owned smart contract in the future
    PCredential.type,
    PYeildOwnerRedeemer.type,
    PScriptContext.type
],  bool)
(( 
    currentOwner, 
    { newOwner, ownInputIdx },
    { tx, purpose }
) => {

    const ownInput = plet(
        tx.inputs.at( ownInputIdx )
    );

    const someInputFrom = plet(
        plam( PCredential.type, bool )
        ( entity => 
            tx.inputs.some( input => 
                getInputPaymentCreds.$( input ).eq( entity )
            )
        )
    )

    // require both old owner and new owner to sign
    // we want to support also scripts on top of public keys
    // so we check for inputs and not `signatories`
    // this requires to spend an utxo
    const inputFromCurrentOwner = someInputFrom.$( currentOwner );

    const inputFromNewOwner = someInputFrom.$( newOwner );

    const validOwnInput = ownInput.utxoRef.eq(
        pmatch( purpose )
        .onSpending(({ utxoRef }) => utxoRef )
        ._( _ => perror( PTxOutRef.type ) )
    ); 

    return inputFromCurrentOwner
    .and(  inputFromNewOwner     )
    // make sure info is updated
    .and( validOwnInput )
    .and(
        // we don't want to inline this
        // so we use `plet().in()`
        plet( ownInput.resolved.address )
        .in( ownAddr => 
            tx.outputs
            .filter( out => out.address.eq( ownAddr ) )
            .every( out => out.datum.eq(
                    POutputDatum.InlineDatum({
                        datum: newOwner as any
                    })
                )
            )
        )
    )
});

export const yeildReserveOwnerOracleScript = new Script(
    "PlutusScriptV2",
    compile(
        makeValidator(
            yeildReserveOwnerOracle
        )
    )
);