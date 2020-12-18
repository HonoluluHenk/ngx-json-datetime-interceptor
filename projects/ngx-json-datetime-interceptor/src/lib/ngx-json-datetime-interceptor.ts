import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http';
import {Injectable, Optional} from '@angular/core';
import cloneDeepWith from 'lodash/cloneDeepWith';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

// noinspection MagicNumberJS
const MINUTE_MSECS = 60 * 1000;

/**
 * <strong>Ordering is important since entries are used to substring-search!</strong>
 */
const DEFAULT_DATE_PROPERTY_SUFFIXES = ['DateTime', 'Date', 'Time'];
export type MissingTimezoneConversion = 'treat-as-local' | 'treat-as-utc';

export interface Configuration {
  missingTimezoneConversion?: MissingTimezoneConversion;
}

export class Configurator {
  private readonly missingTimezoneConversion: MissingTimezoneConversion;

  constructor(opts?: Configuration) {
    this.missingTimezoneConversion = opts?.missingTimezoneConversion ?? 'treat-as-local';
  }

  getMissingTimezoneConversion(): MissingTimezoneConversion {
    return this.missingTimezoneConversion;
  }
}

@Injectable({
  providedIn: 'root',
})
export class NgxJsonDatetimeInterceptor implements HttpInterceptor {
  readonly config: Configurator;
  constructor(
    @Optional() config: Configurator | null,
  ) {
    this.config = config ?? new Configurator();
  }

  public intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    /**
     * Analog wie Angular den content-type bestimmt.
     * Denn dieser ist, wenn nicht explizit im request gesetzt, hier noch nicht im request
     * sondern wird erst später über {@link HttpRequest.detectContentTypeHeader} erzeugt.
     */
    const contentType = req.headers.get('Content-Type') || req.detectContentTypeHeader();

    let actualRequest = req;
    if (contentType === 'application/json') {
      const bodyWithUTC = bodyToBackend(req.body, this.config);
      actualRequest = req.clone({body: bodyWithUTC});
    }

    return next.handle(actualRequest).pipe(
      map((val: HttpEvent<any>) => mapResponse(val, this.config)),
    );
  }
}

function mapResponse(response: HttpEvent<any>, config: Configurator): HttpEvent<any> {
  if (!(response instanceof HttpResponse)) {
    return response;
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType !== 'application/json') {
    return response;
  }

  const body = bodyToFrontend(response.body, config);
  const newResponse = response.clone({body});
  return newResponse;
}

function isSuppportedProperty(key: number | string | undefined): boolean {
  const found = DEFAULT_DATE_PROPERTY_SUFFIXES
    .find(suffix => (typeof key === 'string' && key.endsWith(suffix)));

  const result = found !== undefined;

  return result;
}

export function bodyToFrontend(body: any, config: Configurator): any {
  if (body === null || body === undefined || (typeof body !== 'object')) {
    return;
  }

  const result = cloneDeepWith(body, (value: any, key: number | string | undefined, obj, stack): any => {
    if (!isSuppportedProperty(key)) {
      return undefined;
    }
    // noinspection UnnecessaryLocalVariableJS
    const converted = valueToFrontend(value, config);

    return converted;
  });

  return result;

}

function localeZoneOffsetMsec() {
  const offsetMinutes = new Date().getTimezoneOffset();
  const offsetMsec = offsetMinutes * MINUTE_MSECS;
  return offsetMsec;
}

function parseDateAsLocal(parsed: Date): Date {
  const offsetMsec = localeZoneOffsetMsec();
  const adjustedMsec = parsed.getTime() + offsetMsec;

  const adjusted = new Date(adjustedMsec);

  const result = new Date(
    adjusted.getFullYear(),
    adjusted.getMonth(),
    adjusted.getDate(),
    adjusted.getHours(),
    adjusted.getMinutes(),
    adjusted.getSeconds(),
    adjusted.getMilliseconds(),
  );

  return result;
}

function valueToFrontend(value: any, config: Configurator): Date {
  if (typeof value !== 'string') {
    return value;
  }

  const parsed = new Date(Date.parse(value));
  let result: Date = parsed;
  if (config.getMissingTimezoneConversion() === 'treat-as-local') {
    result = parseDateAsLocal(parsed);
  }

  return result;
}

export function bodyToBackend(body: any, config: Configurator): any {
  if (body === null || body === undefined || (typeof body !== 'object')) {
    return;
  }

  const result = cloneDeepWith(body, (value: any, key: number | string | undefined): any => {
    if (!isSuppportedProperty(key)) {
      return undefined;
    }
    // noinspection UnnecessaryLocalVariableJS
    const converted = valueToBackend(value, config);

    return converted;
  });

  return result;
}

function valueToBackend(value: any, config: Configurator): any {
  if (!(value instanceof Date)) {
    return value;
  }

  let adjusted = value;
  if (config.getMissingTimezoneConversion() !== 'treat-as-utc') {
    adjusted = treatLocalAsUTC(value);
  }

  const result = chopZulu(adjusted.toISOString());
  return result;
}

function treatLocalAsUTC(value: Date): Date {
  const offsetMsec = localeZoneOffsetMsec();
  const adjustedMsec = value.getTime() - offsetMsec;

  const result = new Date(adjustedMsec);

  return result;
}

function chopZulu(isoDate: string): string {
  const result = isoDate.replace(/Z$/, '');
  return result;
}
