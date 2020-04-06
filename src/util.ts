import { fold, Either } from 'fp-ts/lib/Either'
import { Errors } from 'io-ts'

export function fromEither<T>(e: Either<Errors, T>): Promise<T> {
  return fold(
    (cause) => Promise.reject(new Error(JSON.stringify(cause))),
    (res: T) => Promise.resolve(res),
  )(e)
}
