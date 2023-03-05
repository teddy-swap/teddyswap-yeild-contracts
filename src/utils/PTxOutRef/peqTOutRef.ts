import { PTxOutRef, bool, fn, peqData, pfn, phoist, punsafeConvertType } from "@harmoniclabs/plu-ts";

// PTxOutRef is just a struct
const peqTxOutRef = punsafeConvertType(
    peqData,
    fn([
        PTxOutRef.type,
        PTxOutRef.type
    ],  bool)
);

export default peqTxOutRef;