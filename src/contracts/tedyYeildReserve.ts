import { PAddress, PBool, PByteString, PCredential, PCurrencySymbol, PScriptContext, PTokenName, PTxInInfo, PTxOut, PTxOutRef, PValidatorHash, Script, Term, TermFn, UtilityTermOf, bool, compile, data, fn, int, list, makeValidator, pBool, perror, pfn, phead, pif, pisEmpty, plam, plet, pmatch, precursive, pstruct, punBData, punConstrData, punsafeConvertType } from "@harmoniclabs/plu-ts";
import { getOutCreds } from "../utils/getOutCreds";

export const PReserveDatum = pstruct({
    PReserveDatum: {
        // founds allocated to time
        time: int,
        // snapshot of total staked supply for that time
        totStakedSupply: int,
        /**
         * since multiple inputs can be included from this script
         * 
         * any loop (or recursive call) in this contract will be executed for each utxo
         * 
         * we need to loop over all inputs and outputs to calculate rewards eraned over time
         * 
         * so we forward the spending of all these outputs to a pre-chosen validator
         * (ideally the stake contract itself)
         * 
         * we still check that the transaction contains only a single input from the validator
         * (to prevent double satisfaciton)
         * 
         * and we also check that all other inputs are from this contract ( the reserve )
         * 
         * There is no need to check that all the other inputs have the same `forwardedValidator`
         * because only the first input can be a different contract and if it differs for any of these inputs
         * then the `fstInputIsForwarded` condition fails
         * 
         * we can't really check the outputs as some migth be drained (aka. all rewards on that utxo are distributed)
         * so also outputs are forwarded to the validator specified
         * 
         * but **without** any additional logic on the reweard calculation that is expected to happen
         * in the forwarded validator
        **/
        forwardValidator: PValidatorHash.type,
        lpTokenCurrSym: PCurrencySymbol.type,
        lpTokenName: PTokenName.type
    }
});

const PReserveRedeemer = pstruct({
    Harvest: {
        ownInputIdx: int
    },
    BackToOwner: {
        ownerOracleRefInIdx: int
    }
});


/**
 * contract that holds the TEDY to be distributed
**/
const tedyYeildReserve = pfn([
    PValidatorHash.type,
    PCurrencySymbol.type, // NFT currency symbol that must be present in the oracle value
    PReserveDatum.type,
    PReserveRedeemer.type,
    PScriptContext.type
],  bool)
((
    oracleValHash,      // yeildReserveOwnerOracle
    oracleCurrSymId,    // NFT currency symbol that must be present
    datum, rdmr, ctx
) => {

    const { tx, purpose } = ctx;

    return pmatch( rdmr )
    /**
     * reserve UTxO going back to main protocol treasurery
     */
    .onBackToOwner( ({ ownerOracleRefInIdx }) => {

        const oracleRefIn = plet( tx.refInputs.at( ownerOracleRefInIdx ).resolved );

        const thisContractOwnerCredentials = plet(
            /*
            only fails with the `NoDatum` `POutputDatum` constructor is used
            instead both `DatumHash` and `InlineDatum` do have a field
            
            however, even if it is a `DatumHash` is not a problem,
            since we are expecting some `PCredentials`, which are a structured data 
            and not a `DataB` as the field of `DatumHash` (machine will throw an error on equality)

            so essentially only works with inline datums
            */
            PCredential.fromData(
                oracleRefIn.datum.raw.fields.head
            )
        )
        //.in( thisContractOwnerCredentials => {

        // inlined
        //
        // checks that the currency symbol passed as parameter is present
        const isValidOracleRefIn = oracleRefIn.value.some( entry => entry.fst.eq( oracleCurrSymId ) ); 
            
        // check that is actually a reference input form the oracle
        const oracleRefInComesFromContract = 
            pmatch( getOutCreds.$( oracleRefIn ) )
            .onPScriptCredential( ({ valHash }) => valHash.eq( oracleValHash ) )
            .onPPubKeyCredential( _ => perror( bool ) )

        const reserveOwnerSigned =
            // check the inputs and not the signatories
            // 
            // this is done for two reasons:
            //
            // 1) if it is an actual user (a pkh), they would have to include one of
            //    their utxo anyway because of the tx fees
            // 2) to allow smart contracts to provide and stake liquidity
            tx.inputs.some( _in => 
                getOutCreds.$( _in.resolved )
                .eq( thisContractOwnerCredentials )
            );
                

        const allOutsToOwner = 
            // requires one input from the reserve owner
            // (aka. the owner must be aware of the transfer)
            tx.outputs.every( out => getOutCreds.$( out ).eq( thisContractOwnerCredentials ) );

        return isValidOracleRefIn
        .and(  oracleRefInComesFromContract )
        .and(  reserveOwnerSigned )
        .and(  allOutsToOwner );
            
    })
    .onHarvest( ({ ownInputIdx }) => {

        const _ownInput = plet(
            tx.inputs.at( ownInputIdx )
        );

        const ownInputUtxoRef = _ownInput.utxoRef;
        const ownInput = _ownInput.resolved;

        const ownHash = plet(
            punBData.$(
                phead( data ).$(
                    ownInput.address.credential.raw.fields
                )
            )
        )
    
        const ownUtxoRef = plet(
            pmatch( purpose )
            .onSpending( ({ utxoRef }) => utxoRef )
            ._( _ => perror( PTxOutRef.type ))
        )

        const ownInputIsValid = ownInputUtxoRef.eq( ownUtxoRef );

        // see `forwardValidator` comment
        const fstInputIsForwarded = 
            pmatch( tx.inputs.head.resolved.address.credential )
            .onPScriptCredential(({ valHash }) =>
                valHash.eq( datum.forwardValidator )
            )
            ._( _ => perror( bool ) );

        const allOtherInputsAreOwn =
        tx.inputs.tail.every( ({ resolved: input }) =>
            pmatch( input.address.credential )
            .onPScriptCredential(({ valHash }) => valHash.eq( ownHash ) )
            .onPPubKeyCredential( _ => perror( bool ) )
        );
        
        return ownInputIsValid
        .and(  fstInputIsForwarded )
        .and(  allOtherInputsAreOwn );

    })
});


export const mkTedyYeildReserveScript = (
    oracleValHash: Term<typeof PValidatorHash>,
    oracleCurrSymId: Term<typeof PCurrencySymbol>
) => new Script(
    "PlutusScriptV2",
    compile(
        makeValidator(
            tedyYeildReserve
            .$( oracleValHash )
            .$( oracleCurrSymId )
        )
    )
);