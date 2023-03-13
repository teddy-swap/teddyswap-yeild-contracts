import { PCredential, PCurrencySymbol, PScriptContext, PTxOut, PTxOutRef, PValidatorHash, PaymentCredentials, TxOut, addUtilityForType, bool, bs, data, int, pBool, perror, pfn, plam, plet, pmatch, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";

export const PReserveDatum = pstruct({
    PReserveDatum: {
        // founds allocated to time
        time: int,
        // snapshot of total staked supply for that time
        totStakedSupply: int,
        // lq token policy to which rewards are allocated to
        lqPolicy: PValidatorHash.type
    }
});

const PReserveRedeemer = pstruct({
    Harvest: {},
    BackToOwner: {
        ownerOracleRefInIdx: int
    }
});

/**
 * contract that holds the TEDY to be distributed
**/
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
        /**
         * UTxO going back to main protoco treasurery
         */
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
            
            plet(
                plam( PCredential.type, bs )
                ( creds => 
                    punBData.$(
                        punConstrData.$( creds as any ).snd.head
                    )
                )
            ).in( getCredentialHashRegardless => {

                const isValidOracleRefIn = oracleRefIn.value.some( entry => entry.fst.eq( oracleCurrSymId ) ); 
                
                const oracleRefInComesFromContract = 
                    // is actually a reference input form the oracle
                    oracleRefIn.address.extract("credential")
                    .in(({ credential }) =>
                    
                        pmatch( credential )
                        .onPPubKeyCredential( _ => perror( bool ) )
                        .onPScriptCredential( _ => _.extract("valHash").in( ({ valHash }) =>
                            valHash.eq( oracleValHash ) 
                        ))

                    );

                const lqProviderSigned = 
                    // requires one input from the LP token owner
                    // (aka. the owner must be aware of the transfer)
                    plet(
                        /*
                        only fails with the `NoDatum` `POutputDatum` constructor is used
                        instead both `DatumHash` and `InlineDatum` do have a field
                        
                        however, even if it is a `DatumHash` is not a problem,
                        since we are expecting some `PCredentials`, which are a structured data 
                        and not a `DataB` as the field of `DatumHash`
                        */
                        punConstrData.$( oracleRefIn.datum as any )
                        .snd.head // first field (either datum hash or the actual datum)
                    ).in( thisContractOwnerCredentials =>

                        // check teh inputs only
                        // this is done for two reasons:
                        //
                        // 1) if it is an actual user he would have to include one of
                        //    their utxo anyway because of the tx fees
                        // 2) to allow smart contracts to provide and stake liquidity
                        tx.inputs.some( _in => 
                        _in.extract("resolved").in( ({ resolved }) => 
                            getOutCreds.$( resolved ).eq( thisContractOwnerCredentials as any )
                        ))

                    )

                    

                return isValidOracleRefIn
                .and(  oracleRefInComesFromContract )
                .and(  lqProviderSigned )
                .and(
                    // requires all outputs back to owner NO
                    fix_this

                    tx.outputs.every( out =>
                        getOutCreds.$( out ).eq( oracleRefIn.datum as any )
                    )
                )
                
            })))))
        ))
        .onHarvest( _ =>
        )

    ))


    return pBool( false )
})