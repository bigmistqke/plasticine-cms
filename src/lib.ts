import * as v from "valibot";

class SchemaError<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> | v.BaseSchemaAsync<unknown, unknown, v.BaseIssue<unknown>>> extends Error {
    /**
    * The error issues.
    */
    readonly issues: Array<[v.InferIssue<TSchema>, ...v.InferIssue<TSchema>[]]>;
    /**
    * Creates a Valibot error with useful information.
    *
    * @param issues The error issues.
    */
    constructor(issues: Array<[v.InferIssue<TSchema>, ...v.InferIssue<TSchema>[]]>) {
        super()
        this.issues = issues
    }
}

type Prettify<T> = { [K in keyof T]: T[K]; } & {};

interface Version<T1 extends v.GenericSchema = v.GenericSchema, T2 extends v.GenericSchema = v.GenericSchema> {
    schema: T2,
    transform(schema: v.InferInput<T1>): v.InferInput<T2>
}

interface Schema<
    TVersions extends Array<Version>,
    T1 extends v.GenericSchema,
> {
    schema: T1;
    parse(value: v.InferInput<TVersions[number]['schema'] | T1>): v.InferInput<T1>
    version<T2 extends v.GenericSchema, TTransform extends (value: v.InferInput<T1>) => v.InferInput<T2>>(
        schema: T2,
        transform: TTransform,
    ): Prettify<Schema<[...TVersions, { schema: T1, transform: TTransform }], T2>>;
}

function schema<T1 extends v.GenericSchema = v.GenericSchema>(schema: T1): Schema<[], T1> {
    return {
        schema,
        parse(value) {
            const result = v.safeParse(schema, value)
            if (result.success) {
                return result.output
            }
        },
        version(
            newSchema,
            transform,
        ) {
            return version([{ schema, transform }], newSchema);
        },
    } satisfies Schema<[], T1>
}

function version<TVersions extends Array<Version>, T1 extends v.GenericSchema>(
    versions: TVersions,
    schema: T1,
): Prettify<Schema<TVersions, T1>> {
    return {
        schema,
        parse(value) {
            const result = v.safeParse(schema, value)

            if (result.success) {
                return result.output
            }

            const _versions: Array<Version & v.SafeParseResult<T1>> = []
            let foundValidVersion = false

            for (const version of versions) {
                const result = v.safeParse(version.schema, value)

                _versions.push({ ...version, ...result })

                if (result.success) {
                    foundValidVersion = true
                    break
                }
            }

            if (foundValidVersion) {
                return _versions.toReversed().reduce((value, { transform }) => transform(value), value)
            }

            throw new SchemaError(_versions.map(({ issues }) => issues).filter(v => v !== undefined))
        },
        version(schema, transform) {
            return version([{ schema, transform }, ...versions], schema)
        },
    } satisfies Prettify<Schema<TVersions, T1>>
}

const data = schema(v.object({ id: v.string() })).version(
    v.object({ version: v.literal(1), data: v.object({ id: v.string() }) }),
    (data) => ({ version: 1, data } as const),
).version(
    v.object({ version: v.literal(2), data: v.object({ id: v.string() }) }),
    ({ data }) => ({ version: 2, data }) as const,
).version(
    v.object({ version: v.literal(3), data: v.object({ id: v.string() }) }),
    ({ data }) => ({ version: 3, data }) as const,
);

console.log(data.parse({ id: "hallo" }))

const test = v.object({ id: v.string() })
const result = await test['~standard'].validate('value')