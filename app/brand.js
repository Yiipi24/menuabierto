import Link from "next/link";

// La marca aparece en siete pantallas. Centralizarla evita que el logo cambie
// en unas y no en otras la próxima vez que se retoque.
export default function Brand({ href = "/" }) {
  return (
    <Link className="brand" href={href}>
      <img className="brand-mark" src="/logo.svg" alt="" width={28} height={28} />
      Menú Abierto
    </Link>
  );
}
