export type Role = "SUPER_ADMIN" | "MANAGER" | "SELLER";

export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  designation: string | null;
  employeeCode: string | null;
  address: string | null;
  pincode: string | null;
  aadharNumber: string | null;
  drivingLicense: string | null;
  education: string | null;
  passwordHash: string;
  role: Role;
  active: boolean;
  tokenVersion: number;
  managerId: string | null;
  state: string | null;
  district: string | null;
  village: string | null;
  permissions: string[];
};

export type PublicUser = Omit<AuthUser, "passwordHash" | "tokenVersion">;

export const authUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  alternatePhone: true,
  designation: true,
  employeeCode: true,
  address: true,
  pincode: true,
  aadharNumber: true,
  drivingLicense: true,
  education: true,
  passwordHash: true,
  role: true,
  active: true,
  tokenVersion: true,
  managerId: true,
  permissions: true,
  state: true,
  district: true,
  village: true,
} as const;

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    alternatePhone: user.alternatePhone,
    designation: user.designation,
    employeeCode: user.employeeCode,
    address: user.address,
    pincode: user.pincode,
    aadharNumber: user.aadharNumber,
    drivingLicense: user.drivingLicense,
    education: user.education,
    role: user.role,
    active: user.active,
    managerId: user.managerId,
    state: user.state,
    district: user.district,
    village: user.village,
    permissions: user.permissions,
  };
}

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  alternatePhone: true,
  designation: true,
  employeeCode: true,
  address: true,
  pincode: true,
  aadharNumber: true,
  drivingLicense: true,
  education: true,
  role: true,
  active: true,
  managerId: true,
  permissions: true,
  state: true,
  district: true,
  village: true,
} as const;
