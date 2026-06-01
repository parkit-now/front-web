interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 6,
}: SkeletonProps) {
  return <div className="pk-skel" style={{ width, height, borderRadius }} />;
}
