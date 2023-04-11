import { PCredential, PTxOut, phoist, plam } from "@harmoniclabs/plu-ts";

export const getOutCreds = phoist(
    plam( PTxOut.type, PCredential.type )
    ( out => out.address.credential )
);