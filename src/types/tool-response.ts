export type ToolResponse<Response> =
  | {
      result: Response;
      isError: false;
      error: null;
    }
  | {
      result: null;
      isError: true;
      error: string;
    };
