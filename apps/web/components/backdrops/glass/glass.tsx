import styles from "./glass.module.css";

export function GlassBackdrop() {
  return (
    <div className={styles.glass}>
      <div className={styles.glow} />
      <div className={styles.grain} />
      <div className={styles.sheen} />
      <div className={styles.sheen} />
    </div>
  );
}
