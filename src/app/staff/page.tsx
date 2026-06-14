import StaffPageDynamic from "./StaffPageDynamic";

export const dynamic = "force-static";
export const revalidate = 3600;

export default function StaffPage() {
  return <StaffPageDynamic />;
}
