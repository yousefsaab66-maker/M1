import StaffLoginPageDynamic from "./StaffLoginPageDynamic";

export const dynamic = "force-static";
export const revalidate = 3600;

export default function StaffLoginPage() {
  return <StaffLoginPageDynamic />;
}
