import { CardanoCliPlutsBaseError } from "@harmoniclabs/cardanocli-pluts";
import { Data, Machine, Term, isData } from "@harmoniclabs/plu-ts";

export function onchainToOffchainData( term: Term<any>): Data
{
    const { value } = Machine.evalSimple( term ) as any;
    if( value === undefined || !isData( value ) )
    throw new CardanoCliPlutsBaseError(
        "term can't be converted to data"
    );
    return value;
}