"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/features/i18n/I18nProvider";

const helpSections = {
	es: [
		{
			title: "Construir y conectar",
			items: [
				[
					"Agregar bloques",
					"Pulsa un bloque del panel lateral para incorporarlo al diagrama. En móvil, usa «Agregar bloques» para acceder al panel.",
				],
				[
					"Editar y mover",
					"Edita los campos dentro de cada bloque. Arrastra el cuerpo del bloque para cambiar su posición.",
				],
				[
					"Conectar",
					"Arrastra desde el punto de salida de un bloque hasta el punto de entrada del siguiente. Las decisiones tienen salidas Sí y No.",
				],
				[
					"Cambiar los puntos",
					"Selecciona un bloque y usa el menú de puertos para colocar sus entradas y salidas arriba, abajo o a los lados.",
				],
			],
		},
		{
			title: "Navegar por el canvas",
			items: [
				[
					"Desplazarse y acercar",
					"Arrastra una zona vacía para moverte. Usa la rueda del ratón, el gesto de pellizco o los botones + y − para cambiar el zoom.",
				],
				[
					"Ver el diagrama",
					"Usa el control de ajustar vista para encuadrar el diagrama y el minimapa para orientarte.",
				],
				[
					"Pantalla completa",
					"Pulsa el icono de pantalla completa en la esquina superior derecha del canvas. En ese modo, las pestañas de los bordes abren los paneles de bloques, ejecución y resultados.",
				],
			],
		},
		{
			title: "Selección y atajos",
			items: [
				[
					"Seleccionar y eliminar",
					"Pulsa un bloque o una conexión para seleccionarlo. Mantén Shift y arrastra sobre una zona vacía para seleccionar varios. Backspace elimina la selección cuando no estás editando un campo.",
				],
				[
					"Deshacer y rehacer",
					"Usa los botones del canvas o Ctrl/Cmd + Z para deshacer y Ctrl/Cmd + Shift + Z para rehacer.",
				],
				[
					"Mover en un solo eje",
					"Mientras arrastras un bloque, mantén X para fijar su coordenada horizontal (moverlo verticalmente) o Y para fijar su coordenada vertical (moverlo horizontalmente).",
				],
			],
		},
		{
			title: "Ejecutar y entender",
			items: [
				[
					"Paso a paso",
					"Avanza una instrucción cada vez para observar el recorrido del algoritmo.",
				],
				[
					"Ejecutar, pausar e instantáneo",
					"Ejecutar recorre el diagrama automáticamente; Pausar detiene el avance. Instantáneo calcula el resultado sin esperar la animación de cada paso.",
				],
				[
					"Entradas y resultados",
					"Cuando el programa solicite un dato, introdúcelo en el diálogo. Consulta Variables, Salidas e Historial para seguir lo que ocurre. Reiniciar vuelve al comienzo de la ejecución.",
				],
				[
					"Validación y funciones",
					"Revisa el panel de validación si no puedes conectar o ejecutar. En Funciones puedes crear subprogramas y alternar entre sus diagramas y el principal.",
				],
			],
		},
		{
			title: "Ejercicios y código",
			items: [
				[
					"Practicar",
					"Selecciona un ejercicio, despliega sus instrucciones y usa el panel de pruebas para comprobar tu solución. Revisa también las técnicas que pide el ejercicio.",
				],
				[
					"JavaScript",
					"Debajo del canvas, las herramientas de código permiten generar JavaScript desde tu diagrama o importar código para crear un diagrama. Revisa los avisos que aparezcan al importar.",
				],
			],
		},
		{
			title: "Archivos y cuenta",
			items: [
				[
					"Importar y exportar",
					"Usa Importar JSON para abrir un diagrama guardado y Exportar para ver las opciones de descarga. Limpiar vacía el diagrama activo.",
				],
				[
					"Navegación",
					"El logo abre el editor. El encabezado permite acceder a tus proyectos, entregas o panel según tu cuenta, cambiar el idioma y cerrar sesión.",
				],
			],
		},
	],
	en: [
		{
			title: "Build and connect",
			items: [
				[
					"Add blocks",
					"Click a block in the side panel to add it to the diagram. On mobile, use “Add blocks” to reach the panel.",
				],
				[
					"Edit and move",
					"Edit the fields inside each block. Drag the body of a block to reposition it.",
				],
				[
					"Connect",
					"Drag from a block’s output point to the next block’s input point. Decisions have Yes and No outputs.",
				],
				[
					"Change connection points",
					"Select a block and use its ports menu to place inputs and outputs on the top, bottom or sides.",
				],
			],
		},
		{
			title: "Navigate the canvas",
			items: [
				[
					"Pan and zoom",
					"Drag an empty area to move around. Use the mouse wheel, a pinch gesture or the + and − buttons to zoom.",
				],
				[
					"See the diagram",
					"Use the fit-view control to frame the diagram and the minimap to find your way around.",
				],
				[
					"Fullscreen",
					"Click the fullscreen icon at the top right of the canvas. In fullscreen, tabs along the edges open the blocks, execution and results panels.",
				],
			],
		},
		{
			title: "Selection and shortcuts",
			items: [
				[
					"Select and delete",
					"Click a block or connection to select it. Hold Shift and drag over an empty area to select several. Backspace deletes the selection when you are not editing a field.",
				],
				[
					"Undo and redo",
					"Use the canvas buttons, or Ctrl/Cmd + Z to undo and Ctrl/Cmd + Shift + Z to redo.",
				],
				[
					"Move along one axis",
					"While dragging a block, hold X to fix its horizontal coordinate (move vertically), or Y to fix its vertical coordinate (move horizontally).",
				],
			],
		},
		{
			title: "Run and understand",
			items: [
				[
					"Step by step",
					"Advance one instruction at a time to follow the algorithm’s path.",
				],
				[
					"Run, pause and instant",
					"Run advances automatically; Pause stops progress. Instant calculates the result without waiting for each step’s animation.",
				],
				[
					"Inputs and results",
					"When the program requests a value, enter it in the dialog. Check Variables, Outputs and History to follow what happens. Reset returns execution to the beginning.",
				],
				[
					"Validation and functions",
					"Check the validation panel if you cannot connect or run. In Functions, create subprograms and switch between their diagrams and the main diagram.",
				],
			],
		},
		{
			title: "Exercises and code",
			items: [
				[
					"Practice",
					"Select an exercise, expand its instructions and use the test panel to check your solution. Also review the techniques required by the exercise.",
				],
				[
					"JavaScript",
					"Below the canvas, the code tools generate JavaScript from your diagram or import code to create a diagram. Review any import warnings.",
				],
			],
		},
		{
			title: "Files and account",
			items: [
				[
					"Import and export",
					"Use Import JSON to open a saved diagram and Export to see download options. Clear empties the active diagram.",
				],
				[
					"Navigation",
					"The logo opens the editor. The header provides access to projects, submissions or the dashboard depending on your account, language switching and sign out.",
				],
			],
		},
	],
};

export function AppHelp() {
	const { language } = useI18n();
	const es = language === "es";
	const [open, setOpen] = useState(false);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const titleId = useId();
	const descriptionId = useId();

	useEffect(() => {
		if (!open) return;
		const dialog = dialogRef.current;
		if (!dialog) return;

		const previousOverflow = document.body.style.overflow;
		dialog.showModal();
		titleRef.current?.focus();
		document.body.style.overflow = "hidden";

		return () => {
			dialog.close();
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	return (
		<>
			<button
				type="button"
				aria-label={es ? "Ayuda y controles" : "Help and controls"}
				title={es ? "Ayuda y controles" : "Help and controls"}
				aria-haspopup="dialog"
				onClick={() => setOpen(true)}
				className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
			>
				<span aria-hidden="true">?</span>
			</button>
			<dialog
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				onClose={() => setOpen(false)}
				className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
			>
				<div className="flex max-h-[85dvh] flex-col">
					<div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
						<div>
							<h2
								ref={titleRef}
								tabIndex={-1}
								id={titleId}
								className="text-lg font-semibold outline-none"
							>
								{es ? "Guía de controles" : "Controls guide"}
							</h2>
							<p id={descriptionId} className="mt-1 text-sm text-slate-500">
								{es
									? "Todo lo que necesitas para trabajar con FlowCode."
									: "Everything you need to work with FlowCode."}
							</p>
						</div>
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label={es ? "Cerrar ayuda" : "Close help"}
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
						>
							<span aria-hidden="true">×</span>
						</button>
					</div>
					<div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
						<div className="grid gap-6 sm:grid-cols-2">
							{helpSections[es ? "es" : "en"].map((section, index) => (
								<section key={section.title}>
									<h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
										<span
											aria-hidden="true"
											className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs text-emerald-800"
										>
											{index + 1}
										</span>
										{section.title}
									</h3>
									<dl className="space-y-3 text-sm leading-6">
										{section.items.map(([label, description]) => (
											<div key={label}>
												<dt className="font-medium text-slate-800">{label}</dt>
												<dd className="text-slate-500">{description}</dd>
											</div>
										))}
									</dl>
								</section>
							))}
						</div>
					</div>
					<div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 sm:px-6">
						<p className="text-xs text-slate-500">
							{es
								? "También puedes cerrar con Esc."
								: "You can also close with Esc."}
						</p>
						<button
							type="button"
							className="fc-button fc-button--primary"
							onClick={() => setOpen(false)}
						>
							{es ? "Entendido" : "Got it"}
						</button>
					</div>
				</div>
			</dialog>
		</>
	);
}
