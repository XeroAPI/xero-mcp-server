export type ToolResponse<Response> =
  | {
      result: Response;
      error: null;
    }
  | {
      result: null;
      error: string;
    };
