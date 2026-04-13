export type ApiSuccess<T> = {
  success: true;
  data: T;
  error: null;
};

export type ApiFailure = {
  success: false;
  data: null;
  error: { message: string; code?: string };
};

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data, error: null };
}

export function fail(message: string, code?: string): ApiFailure {
  return { success: false, data: null, error: { message, code } };
}
