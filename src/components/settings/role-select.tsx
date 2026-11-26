import type { ComponentPropsWithRef } from "react";
import { Select } from "@/components/ui/input";
import type { Role } from "@/lib/auth/session";

const ROLES = ["translator", "admin"] as const satisfies readonly Role[];

export function RoleSelect({
  value,
  onChange,
  ...props
}: Omit<ComponentPropsWithRef<"select">, "value" | "onChange"> & {
  value: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <Select
      mono
      value={value}
      onChange={(e) => {
        const role = ROLES.find((r) => r === e.target.value);
        if (role) onChange(role);
      }}
      {...props}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </Select>
  );
}
