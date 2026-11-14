import { Component, type ReactNode } from 'react';

/** Fängt Darstellungsfehler ab, damit ein beschädigter Datensatz nicht die ganze App leer lässt. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('Darstellungsfehler', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen">
        <h1 className="h1">Hier ist etwas schiefgelaufen</h1>
        <div className="notice warn">
          Diese Ansicht konnte nicht angezeigt werden – vermutlich passt ein gespeicherter Datensatz nicht. Deine Daten sind nicht gelöscht.
          <br />
          <small>{this.state.error.message}</small>
        </div>
        <button className="btn primary block" onClick={() => this.setState({ error: undefined })}>
          Erneut versuchen
        </button>
        <a className="btn block" href="#/heute" onClick={() => this.setState({ error: undefined })}>
          Zu „Heute“
        </a>
        <p className="muted small">Tritt der Fehler weiter auf: unter Einstellungen eine Sicherung exportieren und die letzte Änderung (Import, Übung/Gerät bearbeiten) rückgängig machen.</p>
      </div>
    );
  }
}
