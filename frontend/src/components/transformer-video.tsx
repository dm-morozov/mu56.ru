import { DeferredVideo } from "./deferred-video";
import styles from "./transformer-video.module.css";

export function TransformerVideo() {
  return <section id="video" className="section container" aria-labelledby="transformer-video-title">
    <div className="section-head">
      <h2 id="transformer-video-title">Бамблби и Оптимус на одном празднике</h2>
    </div>
    <figure className={styles.film}>
      <DeferredVideo src="/media/transformers/bumblebee-optimus-party.mp4" poster="/media/transformers/bumblebee-optimus-poster.webp" label="Бамблби и Оптимус Прайм на детском празднике, одна минута" />
      <figcaption>Запись из нашего архива. На этом празднике выступали два больших робота. В базовой программе приезжают один большой робот и второй герой в обычном костюме.</figcaption>
    </figure>
  </section>;
}
