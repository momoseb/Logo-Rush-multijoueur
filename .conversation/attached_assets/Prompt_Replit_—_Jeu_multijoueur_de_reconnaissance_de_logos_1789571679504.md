Je veux développer un jeu web moderne de reconnaissance de logos, jouable en solo ou en multijoueur en temps réel.

Le principe est simple : à chaque manche, un logo apparaît extrêmement pixelisé. Au fil du temps, l'image se dépixelise progressivement jusqu'à devenir parfaitement reconnaissable. Les joueurs doivent trouver le nom de la marque le plus rapidement possible. Plus un joueur trouve tôt, plus il gagne de points.

Je veux une application complète, moderne, responsive et réellement fonctionnelle, pas seulement une maquette.

## Stack

Utilise de préférence :

- React
- TypeScript
- Vite
- Node.js
- WebSockets / Socket.IO pour tout le multijoueur temps réel
- Une architecture propre frontend/backend
- Tailwind CSS ou une solution équivalente pour l'UI
- Base de données légère si nécessaire pour les données persistantes
- État des parties multijoueur géré côté serveur pour éviter que le client puisse tricher facilement

L'application doit fonctionner correctement sur desktop et mobile.

# 1. Page d'accueil

Créer une page d'accueil moderne présentant le jeu avec deux actions principales :

- Jouer en solo
- Jouer en multijoueur

Afficher également éventuellement quelques statistiques simples comme :

- joueurs actuellement en ligne
- salons publics disponibles
- parties en cours

Le design doit être ludique mais premium, avec une esthétique de jeu web moderne.

# 2. Pseudonyme

Aucun compte utilisateur n'est nécessaire pour le MVP.

Avant de jouer, le joueur choisit simplement un pseudonyme.

Le pseudonyme doit :

- faire entre 2 et 20 caractères
- être affiché pendant les parties
- être conservé localement dans le navigateur pour les prochaines parties

# 3. Mode solo

Le joueur peut lancer immédiatement une partie solo.

Avant la partie, il peut choisir :

- nombre de manches : 5 / 10 / 15 / 20
- durée maximale d'une manche : par exemple 15 / 20 / 30 secondes
- difficulté si disponible

Pendant chaque manche :

- afficher le numéro de la manche
- afficher le score total
- afficher le temps restant
- afficher le logo pixelisé au centre
- permettre au joueur de saisir sa réponse dans un champ
- valider avec Entrée ou un bouton

L'image doit progressivement se dépixeliser.

Exemple :

0 seconde → très fortement pixelisée  
5 secondes → un peu moins pixelisée  
10 secondes → encore plus visible  
15 secondes → presque nette  
fin du temps → totalement visible

Le score dépend de la vitesse.

Exemple de principe :

score = score maximum × pourcentage de temps restant

Un joueur trouvant immédiatement peut gagner environ 1000 points.

Plus il attend, moins il gagne.

À la fin de la manche :

- afficher la bonne réponse
- afficher le logo net
- afficher les points gagnés
- passer à la manche suivante après quelques secondes

À la fin :

- afficher le score final
- permettre de rejouer

# 4. Multijoueur

Je veux un véritable mode multijoueur temps réel avec des salons.

La page multijoueur doit afficher :

- bouton "Créer un salon"
- bouton "Rejoindre avec un code"
- liste des salons publics disponibles

Pour chaque salon public afficher :

- nom du salon
- nom de l'hôte
- nombre de joueurs : par exemple 4 / 8
- nombre de manches
- éventuellement état "En attente"
- bouton Rejoindre

La liste doit se mettre à jour automatiquement.

# 5. Création d'un salon

Lorsqu'un joueur crée un salon, il devient l'hôte.

Avant la création, il choisit :

- nom du salon
- salon public ou privé
- nombre maximum de joueurs : 2 / 4 / 6 / 8 / 10 par exemple
- nombre de manches : 5 / 10 / 15 / 20
- durée d'une manche
- éventuellement difficulté

Créer un code de salon court et facile à partager, par exemple :

AB7KQ

Pour un salon privé, il n'apparaît pas dans la liste publique mais peut être rejoint avec son code.

# 6. Lobby

Une fois dans le salon, afficher un lobby.

Afficher :

- nom du salon
- code du salon avec bouton copier
- paramètres de la partie
- liste des joueurs
- indication de l'hôte

Exemple :

👑 Alex  
Marie  
Lucas  
Tom

L'hôte possède un bouton :

"Lancer la partie"

Les autres joueurs voient :

"En attente de l'hôte..."

La partie ne peut commencer que lorsque l'hôte clique sur lancer.

Si l'hôte quitte avant la partie, transférer le rôle d'hôte à un autre joueur si possible.

# 7. Partie multijoueur

Tous les joueurs doivent voir exactement la même manche au même moment.

Le serveur contrôle :

- le logo actuel
- le début de la manche
- le timer
- la fin de la manche
- les scores
- les réponses valides

Le client ne doit pas pouvoir connaître la réponse correcte directement dans les données envoyées avant de l'avoir trouvée.

Afficher pendant la partie :

- manche actuelle, par exemple 4 / 10
- timer
- logo au centre
- champ de réponse
- classement en temps réel des joueurs

Exemple :

1. Alex — 3250 pts
2. Marie — 2800 pts
3. Lucas — 1900 pts
4. Tom — 1700 pts

# 8. Réponse d'un joueur

Lorsqu'un joueur propose une réponse :

- comparer la réponse sans tenir compte des majuscules/minuscules
- ignorer les espaces inutiles
- accepter éventuellement quelques variantes configurées pour une marque

Exemple :

"McDonalds"
"McDonald's"
"mcdonalds"

peuvent être considérés comme équivalents.

Si la réponse est incorrecte :

- afficher brièvement une indication rouge
- permettre d'essayer à nouveau immédiatement

Si elle est correcte :

- désactiver le champ de réponse pour ce joueur
- calculer immédiatement son score
- actualiser le classement chez tous les joueurs

# 9. Ordre des joueurs ayant trouvé

Je veux que la partie indique en temps réel lorsqu'un joueur trouve.

Par exemple :

🥇 Alex a trouvé !
🥈 Marie a trouvé !
Lucas a trouvé !

Le premier joueur à trouver doit être particulièrement mis en avant.

Le classement de la manche peut afficher :

1. Alex — trouvé en 3,2 s — +890 pts
2. Marie — trouvé en 5,8 s — +720 pts
3. Lucas — trouvé en 11,4 s — +430 pts
4. Tom — pas trouvé

Les autres joueurs continuent à jouer même lorsqu'un joueur a déjà trouvé.

La manche se termine lorsque :

- le timer arrive à zéro

OU

- tous les joueurs ont trouvé

# 10. Dépixelisation

C'est l'élément central du jeu.

Implémenter un véritable effet de dépixelisation progressive.

On peut par exemple :

- utiliser un Canvas HTML
- afficher une version réduite de l'image puis l'agrandir sans interpolation
- augmenter progressivement la résolution utilisée

Exemple :

début :
8 × 8 pixels

puis :
12 × 12
20 × 20
32 × 32
64 × 64
128 × 128
image originale

La transition doit être progressive et agréable.

Le serveur doit envoyer le moment de début de la manche et tous les clients calculent l'état de pixelisation à partir de ce timestamp pour rester synchronisés.

# 11. Fin de manche

Lorsque le temps est terminé :

afficher pendant environ 3 à 5 secondes un écran récapitulatif avec :

- logo complètement visible
- nom correct de la marque
- classement de la manche
- points gagnés
- classement général

Puis lancer automatiquement la manche suivante.

# 12. Fin de partie

Après la dernière manche, afficher un écran de résultats.

Mettre clairement en avant :

🏆 le gagnant

Puis afficher le classement complet.

Exemple :

🏆 Alex — 8 450 pts
🥈 Marie — 7 920 pts
🥉 Lucas — 6 380 pts
4. Tom — 5 910 pts

Afficher également éventuellement :

- nombre de premières places
- nombre de logos trouvés
- meilleur temps de réponse
- temps moyen

Ajouter les boutons :

- Rejouer
- Retour au salon
- Quitter

L'hôte peut relancer une nouvelle partie avec le même groupe.

# 13. Logos

Prévoir une architecture permettant d'avoir une collection de logos.

Chaque logo doit pouvoir contenir :

- id
- image
- réponse principale
- réponses alternatives
- catégorie
- difficulté

Exemple :

{
    id: "nike",
    answer: "Nike",
    aliases: ["nike inc"],
    category: "sport",
    difficulty: "easy",
    imageUrl: "..."
}

Prévoir plusieurs catégories pour le futur :

- technologie
- automobile
- sport
- alimentation
- luxe
- jeux vidéo
- cinéma
- réseaux sociaux
- marques françaises
- marques internationales

Pour le prototype, créer un jeu de données de démonstration permettant de tester toutes les fonctionnalités.

Utiliser uniquement des images pour lesquelles l'application dispose d'un droit d'utilisation adapté ; pour le prototype, des placeholders ou ressources de démonstration peuvent être utilisés.

# 14. Synchronisation multijoueur

Utiliser Socket.IO ou WebSockets.

Prévoir des événements similaires à :

room:create
room:join
room:leave
room:update
game:start
round:start
guess:submit
guess:correct
player:found
score:update
round:end
game:end

Le serveur doit rester la source de vérité.

Ne jamais faire confiance au score calculé par le navigateur.

Le serveur doit calculer :

- si une réponse est correcte
- le temps de réponse
- les points obtenus
- le classement

# 15. Déconnexions

Prévoir les cas suivants :

- joueur qui actualise la page
- déconnexion temporaire
- joueur qui quitte
- hôte qui quitte
- salon vide

Essayer de permettre à un joueur de récupérer sa session après une actualisation de page.

Supprimer automatiquement les salons inactifs après un certain temps.

# 16. UX / UI

Je veux un design particulièrement soigné.

Style :

- interface moderne 2026
- dark mode par défaut
- cartes légèrement transparentes
- effets de profondeur subtils
- animations fluides
- gros logo au centre pendant les manches
- typographie moderne
- interface très lisible
- responsive

Ne surcharge pas l'écran.

Pendant une manche, le logo doit être l'élément visuel principal.

Disposition desktop possible :

------------------------------------------------
Manche 4/10                 Temps : 12.4 s

               [ LOGO ]
             PIXELISÉ

            [ Réponse... ]
              Valider

Classement
1. Alex        3200
2. Marie       2890
3. Lucas       2400

Alex a trouvé en premier !
------------------------------------------------

Sur mobile, le classement peut être plus compact ou placé sous le jeu.

Ajouter des animations lorsqu'un joueur trouve :

- petite notification
- mise à jour animée du score
- badge 🥇 pour le premier

# 17. Architecture

Organiser le projet proprement.

Séparer au minimum :

/client
/server
/shared

Créer des modèles TypeScript communs pour :

Player
Room
Game
Round
Logo
Guess
Score

Éviter les gros composants monolithiques.

Créer des composants réutilisables.

# 18. Ordre de développement

Construis l'application progressivement mais rends chaque étape réellement fonctionnelle.

Commence par :

1. structure du projet
2. page d'accueil
3. choix du pseudonyme
4. mode solo complet
5. création des salons
6. liste des salons publics
7. lobby multijoueur
8. Socket.IO
9. synchronisation des manches
10. système de réponses
11. score temps réel
12. écran de fin
13. gestion des déconnexions
14. polish UI / animations

À la fin, teste réellement plusieurs joueurs en ouvrant plusieurs navigateurs ou onglets.

Corrige les bugs de synchronisation avant de considérer le projet terminé.

Le résultat attendu est un véritable MVP jouable de bout en bout, permettant à plusieurs joueurs de rejoindre un salon et de jouer simultanément à une partie de reconnaissance de logos.