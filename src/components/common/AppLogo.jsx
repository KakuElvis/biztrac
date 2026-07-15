export function AppLogo({
  className = "",
  containerClassName = "",
  imageClassName = "h-10 w-10 rounded-2xl object-cover",
  titleClassName = "text-lg font-black text-ink",
  subtitleClassName = "text-xs font-semibold text-slate-500",
  subtitle = "Manage Today. Grow Tomorrow.",
  showText = true,
  alt = "BizTrac logo",
}) {
  const logoUrl = new URL("../../assets/biztrac symbol.png", import.meta.url).href;

  return (
    <div className={`flex items-center gap-3 ${containerClassName} ${className}`.trim()}>
      <img src={logoUrl} alt={alt} className={`shrink-0 ${imageClassName}`.trim()} />
      {showText ? (
        <div className="min-w-0">
          <p className={titleClassName}>BizTrac</p>
          {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
