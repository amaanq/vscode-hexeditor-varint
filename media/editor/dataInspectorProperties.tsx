const MaxVarintLen64 = 10;

/** Reads a uint24 at offset 0 from the buffer. */
const getUint24 = (arrayBuffer: ArrayBuffer, le: boolean) => {
	const buf = new Uint8Array(arrayBuffer);
	return le ? buf[0] | buf[1] << 8 | buf[2] << 16 : buf[0] << 16 | buf[1] << 8 | buf[2];
};

// this language is dumb
// const lshift = (number: number, shift: number): number => {
// 	return number * Math.pow(2, shift);
// };

// const getUint40 = (arrayBuffer: ArrayBuffer, le: boolean) => {
// 	const buf = new Uint8Array(arrayBuffer);
// 	return le ? buf[0] + lshift(buf[1], 8) + lshift(buf[2], 16) + lshift(buf[3], 24) + lshift(buf[4], 32) :
// 		lshift(buf[0], 32) + lshift(buf[1], 24) + lshift(buf[2], 16) + lshift(buf[3], 8) + buf[4];
// };

// const getUint48 = (arrayBuffer: ArrayBuffer, le: boolean) => {
// 	const buf = new Uint8Array(arrayBuffer);
// 	return le ? buf[0] + lshift(buf[1], 8) + lshift(buf[2], 16) + lshift(buf[3], 24) + lshift(buf[4], 32) + lshift(buf[5], 40) :
// 		lshift(buf[0], 40) + lshift(buf[1], 32) + lshift(buf[2], 24) + lshift(buf[3], 16) + lshift(buf[4], 8) + buf[5];
// };

// const getUint56 = (arrayBuffer: ArrayBuffer, le: boolean) => {
// 	const buf = new Uint8Array(arrayBuffer);
// 	return le ? buf[0] + lshift(buf[1], 8) + lshift(buf[2], 16) + lshift(buf[3], 24) + lshift(buf[4], 32) + lshift(buf[5], 40) + lshift(buf[6], 48) :
// 		lshift(buf[0], 48) + lshift(buf[1], 40) + lshift(buf[2], 32) + lshift(buf[3], 24) + lshift(buf[4], 16) + lshift(buf[5], 8) + buf[6];
// };

const getUVarInt = (arrayBuffer: ArrayBuffer) => {
	const buf = new Uint8Array(arrayBuffer);
	let x = 0;
	let s = 0;
	let byteStr = "byte";
	for (let i = 0; i < MaxVarintLen64; i++) {
		if (i > 0 && byteStr != "bytes") byteStr = "bytes";
		const b = buf[i];
		if (b < 0x80) {
			if (i == MaxVarintLen64 - 1 && b > 1) {
				return { value: x, size: i + 1, string: `${x}, (${i + 1} ${byteStr}, overflows)` };
			}
			return { value: x | b << s, size: i + 1, string: `${x | b << s} (${i + 1} ${byteStr})` };
		}
		x |= (b & 0x7f) << s;
		s += 7;
	}
	return { value: x, size: MaxVarintLen64, string: `${x} (${MaxVarintLen64} ${byteStr})` };
};

const getVarInt = (arrayBuffer: ArrayBuffer) => {
	const ux = getUVarInt(arrayBuffer);
	let x = (ux.value >> 1);
	if (ux.value & 1) {
		x = ~x;
	}
	const byteStr = ux.size == 1 ? "byte" : "bytes";
	return { value: x, size: ux.size, string: `${x} (${ux.size} ${byteStr})` };
};


export interface IInspectableType {
	/** Readable label for the type */
	label: string;
	/** Minimum number of bytes needed to accurate disable this type */
	minBytes: number;
	/** Shows the representation of the type from the data view */
	convert(dv: DataView, littleEndian: boolean): string;
}

export const inspectableTypes: readonly IInspectableType[] = [
	{ label: "uint8", minBytes: 1, convert: dv => dv.getUint8(0).toString() },
	{ label: "int8", minBytes: 1, convert: dv => dv.getInt8(0).toString() },

	{ label: "uint16", minBytes: 2, convert: (dv, le) => dv.getUint16(0, le).toString() },
	{ label: "int16", minBytes: 2, convert: (dv, le) => dv.getInt16(0, le).toString() },

	{ label: "uint24", minBytes: 3, convert: (dv, le) => getUint24(dv.buffer, le).toString() },
	{
		label: "int24",
		minBytes: 3,
		convert: (dv, le) => {
			const uint = getUint24(dv.buffer, le);
			const isNegative = !!(uint & 0x800000);
			return String(isNegative ? -(0xffffff - uint + 1) : uint);
		}
	},

	{ label: "uint32", minBytes: 4, convert: (dv, le) => dv.getUint32(0, le).toString() },
	{ label: "int32", minBytes: 4, convert: (dv, le) => dv.getInt32(0, le).toString() },

	{ label: "int64", minBytes: 8, convert: (dv, le) => dv.getBigInt64(0, le).toString() },
	{ label: "uint64", minBytes: 8, convert: (dv, le) => dv.getBigUint64(0, le).toString() },

	{ label: "float32", minBytes: 4, convert: (dv, le) => dv.getFloat32(0, le).toString() },
	{ label: "float64", minBytes: 8, convert: (dv, le) => dv.getFloat64(0, le).toString() },

	{ label: "varint", minBytes: 1, convert: dv => getVarInt(dv.buffer).string },
	{ label: "uvarint", minBytes: 1, convert: dv => getUVarInt(dv.buffer).string },

	{
		label: "UTF-8",
		minBytes: 1,
		convert: dv => {
			const utf8 = new TextDecoder("utf-8").decode(dv.buffer);
			for (const char of utf8) return char;
			return utf8;
		},
	},
	{
		label: "UTF-16",
		minBytes: 2,
		convert: (dv, le) => {
			const utf16 = new TextDecoder(le ? "utf-16le" : "utf-16be").decode(dv.buffer);
			for (const char of utf16) return char;
			return utf16;
		},
	},
];
