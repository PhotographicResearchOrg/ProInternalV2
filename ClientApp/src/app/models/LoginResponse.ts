import { ProUser } from './pro-user'; // Adjust path as needed


export class LoginResponse
{ 
 token: string;
  user:
    {
    id: number;
    name: string;
    email: string;
    username: string;
  };
roles: string[];
permissions: string[]; // Role-derived permissions
extraPermissions: string[]; // Per-user overrides
}


export class RolePermissions {
  roleName: string;
  assignedPermissions: string[];
}
