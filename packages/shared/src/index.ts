// Common types and schemas will go here
export const HelloWorld = 'Hello from @tapestry/shared';

export interface IUser {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt?: string;
}
