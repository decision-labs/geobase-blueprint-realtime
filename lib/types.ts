export interface DrawingAction {
    x: number;
    y: number;
  }
  
  export interface WhiteboardPayload {
    session_id: string;
    user_id: string;
    action: DrawingAction;
  }
  