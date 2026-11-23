import type { UNSAFE_DataWithResponseInit as DataWithResponseInit } from "react-router";

// What a loader or action answered, in one plain shape that tests can assert on with toEqual or
// toMatchObject. It covers every way a route answers: a redirect or other Response, data() with a
// status, or a plain object, each either returned or thrown.
export type RouteOutcome<Data> =
  | {
      thrown: false;
      status: number;
      // The Location header, set for redirects.
      location: string | null;
      headers: Headers;
      // What data() carried or the plain object that was returned. Undefined for a Response.
      data: Data | undefined;
    }
  | {
      thrown: true;
      status: number;
      location: string | null;
      headers: Headers;
      data: unknown;
    };

// The data a route answers with, without the Response and data() wrappers around it.
type DataOf<Result> = Result extends Response
  ? never
  : Result extends DataWithResponseInit<infer Data>
    ? Data
    : Result;

type Route<Args, Result> = (args: Args) => Result | Promise<Result>;

// Calls a loader and describes its answer. Errors other than a Response or data() are rethrown.
export function callLoader<Args, Result>(
  loader: Route<Args, Result>,
  args: Args,
): Promise<RouteOutcome<DataOf<Result>>> {
  return call(loader, args);
}

// Calls an action and describes its answer. Errors other than a Response or data() are rethrown.
export function callAction<Args, Result>(
  action: Route<Args, Result>,
  args: Args,
): Promise<RouteOutcome<DataOf<Result>>> {
  return call(action, args);
}

async function call<Args, Result>(
  route: Route<Args, Result>,
  args: Args,
): Promise<RouteOutcome<DataOf<Result>>> {
  let result: Result;
  try {
    result = await route(args);
  } catch (error) {
    if (error instanceof Response || isDataWithResponseInit(error)) {
      return { thrown: true, ...describe(error) };
    }
    throw error;
  }
  return { thrown: false, ...describe(result) } as RouteOutcome<DataOf<Result>>;
}

function describe(answer: unknown) {
  if (answer instanceof Response) {
    return {
      status: answer.status,
      location: answer.headers.get("Location"),
      headers: answer.headers,
      data: undefined,
    };
  }
  if (isDataWithResponseInit(answer)) {
    const headers = new Headers(answer.init?.headers);
    return {
      status: answer.init?.status ?? 200,
      location: headers.get("Location"),
      headers,
      data: answer.data,
    };
  }
  return { status: 200, location: null, headers: new Headers(), data: answer };
}

function isDataWithResponseInit(value: unknown): value is DataWithResponseInit<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "DataWithResponseInit"
  );
}
