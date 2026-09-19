type Props = {
  size?: number;
  className?: string;
};

// Uses the same icon file as the installed app: public/icons/icon-192.png
export default function Logo({ size = 36, className = '' }: Props) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
      alt="SMRT"
      width={size}
      height={size}
      className={`shrink-0 rounded-lg object-cover ${className}`}
    />
  );
}