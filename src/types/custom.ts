export interface User extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  createdAt: Date;
}

export interface UserDocument extends User {
  createdAt: Date;
  updatedAt: Date;
  _doc?: any;
}



export interface WorkspaceResponse {
  _id: string;
  name: string;
  domain: string;
  logo: {
    name: string;
    key: string;
    type: string;
    size: number;
  } | null;
  storage?: {
    used: string;
    limit: string;
    percentage: string;
    raw: {
      used: string;
      limit: string;
    }
  };
  access: {
    isMember: boolean;
    role: string | null;
  };
  members?: Array<{
    userId: {
      _id: string;
      fullName: string;
      email: string;
      profilePhoto: {
        name: string;
        key: string;
        type: string;
        size: number;
      } | null;
      role: string;
    };
    role: string;
    isCreator: boolean;
  }>;
  creatorId: {
    _id: string;
    fullName: string;
    email: string;
    profilePhoto: {
      name: string;
      key: string;
      type: string;
      size: number;
    } | null;
    role: string;
  };
  createdAt: Date;
  updatedAt: Date;
}