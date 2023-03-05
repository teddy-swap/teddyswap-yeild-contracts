import { PCredential, PCurrencySymbol, PScriptContext, PTxOutRef, PValidatorHash, PaymentCredentials, addUtilityForType, bool, bs, data, int, pBool, perror, pfn, plam, plet, pmatch, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";

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
        ownInputIdx: int,
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
    oracleValHash, 
    oracleCurrSymId, 
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
        .onBackToOwner( _ => _.extract("ownInputIdx").in(({ ownInputIdx }) => 

            txInfo.extract("inputs","outputs").in( tx =>
                
                tx.inputs.at( ownInputIdx )
                .extract("resolved","utxoRef").in( ownInput =>
                    
                    ownInput.utxoRef.eq( ownUtxoRef )
                    .and(
                    )

                )

            ))
        )
        .onHarvest( _ =>
        )
    
    ))


    return pBool( false )
})