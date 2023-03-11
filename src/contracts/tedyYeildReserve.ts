import { PCredential, PCurrencySymbol, PScriptContext, PTxOut, PTxOutRef, PValidatorHash, PaymentCredentials, TxOut, addUtilityForType, bool, bs, data, int, pBool, perror, pfn, plam, plet, pmatch, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";

const PReserveDatum = pstruct({
    PReserveDatum: {
        // founds allocated to time
        time: int,
        // snapshot of total staked supply for that time
        totStakedSupply: int,
        // contracts to wich rewards are allocated to
        contract: PValidatorHash.type
    }
});

const PReserveRedeemer = pstruct({
    Harvest: {},
    BackToOwner: {
        ownerOracleRefInIdx: int
    }
});

const tedyYeildReserve = pfn([
    PValidatorHash.type,
    PCurrencySymbol.type,
    PReserveDatum.type,
    PReserveRedeemer.type,
    PScriptContext.type
],  bool)
((
    oracleValHash,      // yeildReserveOwnerOracle
    oracleCurrSymId,    // NFT currency symbol that must be present
    datum, rdmr, ctx
) => {

    ctx.extract("txInfo","purpose").in(({ txInfo, purpose }) =>

    plet(
        pmatch( purpose )
        .onSpending( _ => _.extract("utxoRef")
            .in( ({ utxoRef: ownUtxoRef }) => ownUtxoRef )
        )
        ._( _ => perror( PTxOutRef.type ))
    ).in( ownUtxoRef => 

        pmatch( rdmr )
        .onBackToOwner( _ => _.extract("ownerOracleRefInIdx").in(({ ownerOracleRefInIdx }) => 

            txInfo.extract("inputs","refInputs","outputs").in( tx =>

            tx.refInputs.at( ownerOracleRefInIdx )
            .extract("resolved").in( ({ resolved: _oracleRefIn }) => 
            _oracleRefIn.extract("address","value","datum").in( oracleRefIn =>

            plet(
                plam( PTxOut.type, PCredential.type )
                ( out =>
                    out.extract("address").in( ({ address: outAddress }) =>
                    outAddress.extract("credential").in( ({ credential }) =>
                        credential
                    ))
                )
            ).in( getOutCreds => 
                // ref input has required NFT
                oracleRefIn.value.some( entry => entry.fst.eq( oracleCurrSymId ) )
                .and(
                    // is actually a reference input form the oracle
                    oracleRefIn.address.extract("credential").in(({ credential }) =>
                        pmatch( credential )
                        .onPPubKeyCredential( _ => perror( bool ) )
                        .onPScriptCredential( _ => _.extract("valHash").in( ({ valHash }) =>
                            valHash.eq( oracleValHash ) 
                        )) 
                    )
                )
                .and(
                    // requires one input from the owner
                    // (the owner mustbe aware of the transfer)
                    tx.inputs.some( _in => 
                    _in.extract("resolved").in( ({ resolved }) => 
                        getOutCreds.$( resolved ).eq( oracleRefIn.datum as any )
                    ))
                )
                .and(
                    // requires all outputs back to owner
                    tx.outputs.every( out =>
                        getOutCreds.$( out ).eq( oracleRefIn.datum as any )
                    )
                )
                
            )))
                
            )
        ))
        .onHarvest( _ =>
        )

    ))


    return pBool( false )
})