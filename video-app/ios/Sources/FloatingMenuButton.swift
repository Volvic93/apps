import UIKit

/// Kleiner, halbtransparenter, verschiebbarer Knopf; ein Tipp öffnet das Menü (`menu`).
/// Rastet am linken oder rechten Rand ein, merkt sich die Lage und bleibt im sicheren Bereich.
final class FloatingMenuButton: UIButton {
    static let diameter: CGFloat = 44
    private static let margin: CGFloat = 8

    private var isDragging = false

    override init(frame: CGRect) {
        super.init(frame: CGRect(x: 0, y: 0, width: FloatingMenuButton.diameter, height: FloatingMenuButton.diameter))
        setUp()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    private func setUp() {
        backgroundColor = UIColor(red: 11.0 / 255.0, green: 15.0 / 255.0, blue: 20.0 / 255.0, alpha: 0.7)
        tintColor = Theme.accent
        layer.cornerRadius = FloatingMenuButton.diameter / 2
        layer.borderWidth = 1
        layer.borderColor = Theme.accent.withAlphaComponent(0.5).cgColor
        alpha = 0.8

        let symbol = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        setImage(UIImage(systemName: "ellipsis", withConfiguration: symbol), for: .normal)

        showsMenuAsPrimaryAction = true
        accessibilityLabel = "Menü"

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        addGestureRecognizer(pan)
    }

    /// Setzt den Knopf anhand der gespeicherten Lage in den sicheren Bereich des Containers.
    func reposition(in container: UIView) {
        guard !isDragging else { return }
        let bounds = container.bounds
        guard bounds.width > 0, bounds.height > 0 else { return }

        let insets = container.safeAreaInsets
        let half = FloatingMenuButton.diameter / 2
        let margin = FloatingMenuButton.margin

        let x: CGFloat
        if AppSettings.shared.buttonSide == 0 {
            x = insets.left + margin + half
        } else {
            x = bounds.width - insets.right - margin - half
        }

        let minY = insets.top + margin + half
        let maxY = bounds.height - insets.bottom - margin - half
        let wanted = CGFloat(AppSettings.shared.buttonY) * bounds.height
        let y = max(minY, min(maxY, wanted))

        center = CGPoint(x: x, y: y)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        guard let container = superview else { return }
        switch gesture.state {
        case .began, .changed:
            isDragging = true
            let translation = gesture.translation(in: container)
            center = CGPoint(x: center.x + translation.x, y: center.y + translation.y)
            gesture.setTranslation(.zero, in: container)
        case .ended, .cancelled, .failed:
            isDragging = false
            let height = max(container.bounds.height, 1)
            AppSettings.shared.buttonSide = center.x < container.bounds.midX ? 0 : 1
            AppSettings.shared.buttonY = Double(center.y / height)
            UIView.animate(withDuration: 0.2) {
                self.reposition(in: container)
            }
        default:
            break
        }
    }
}
