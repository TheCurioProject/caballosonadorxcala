declare module 'node-ical' {
  export const async: {
    fromURL(url: string, opts?: any): Promise<any>;
    parseICS(ics: string): Promise<any>;
  };
  export const sync: {
    parseICS(ics: string): any;
  };
}
