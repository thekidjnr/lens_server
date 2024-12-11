interface UserPayload extends JwtPayload {
  id: string;
  role: {
    Admin: boolean;
    Creative: boolean;
    Client: boolean;
  };
}
