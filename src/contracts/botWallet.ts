import { PAddress, POutputDatum, PScriptContext, PTxOut, PTxOutRef, PValidatorHash, bool, data, perror, pfn, pif, plet, pmakeUnit, pmatch, punIData, unit } from "@harmoniclabs/plu-ts";

export const botWallet = pfn([
    PAddress.type, // where the output must go
    PAddress.type, // owner (claim back)
    data, // int (ownInputIndex)
    PScriptContext.type
],  unit)
(( 
    yeildReserveAddr,
    ownerAddr, ownInputIndexData, { tx, purpose } ) => {

    const ownRef = plet(
        pmatch( purpose )
        .onSpending(({ utxoRef }) => utxoRef )
        ._( _ => perror( PTxOutRef.type ) )
    );

    const _ownIn = plet(
        tx.inputs.at( punIData.$( ownInputIndexData ) )
    );

    const ownInputIsValid = plet( _ownIn.utxoRef.eq( ownRef ) );
    
    const ownAddr = plet( _ownIn.resolved.address );

    // useful for change outs in the tx
    const outStaysHere = plet(
        pfn([
            PTxOut.type
        ],  bool)
        ( out =>
            out.address.eq( ownAddr )
            .and(
                out.datum.eq(
                    POutputDatum.InlineDatum({
                        datum: PAddress.toData( ownerAddr )
                    })
                )
            )
        )
    );

    const allOutsToReserve = tx.outputs.every( out =>
        out.address.eq( yeildReserveAddr )
        .and(
            out.datum.raw.index.eq( 2 ) // POutputDatum.InlineDatum
        )
        .or( outStaysHere.$( out ) )
    );

    // if multiple utxos spent at once as input
    // all of the must have the same address in the datum
    const allOutsToOwner = tx.outputs.every( out =>
        out.address.eq( ownerAddr )
        .or( outStaysHere.$( out ) )
    );

    return pif( unit ).$(

        // is spendnd
        ownInputIsValid
        .and(
            // either 
            allOutsToReserve
            .or( allOutsToOwner )
        )
    )
    .then( pmakeUnit() )
    .else( perror( unit ) )

})