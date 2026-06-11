import Image from "next/image";
import styles from "./page.module.css";
import Link from "next/link";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>MergeUp</h1>
          <p>O clássico 2048, agora multijogador.</p>
        </div>
        <div className={styles.ctas}>
          <Link href="/menu" className={styles.primary}>
            Jogar Agora
          </Link>
          <a
            className={styles.secondary}
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver Código
          </a>
        </div>
      </main>
    </div>
  );
}